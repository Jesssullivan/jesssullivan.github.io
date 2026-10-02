#!/usr/bin/env python3
"""Verify an untrusted shadow-source Docker archive and extract its static COPY.

This is a data parser, not an image loader. In particular, inherited nginx files
must never become Cloudflare Pages files. The caller must independently verify
the live PR/run and the resulting Pages project's deployment authority.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
import tarfile


REPOSITORY = "Jesssullivan/jesssullivan.github.io"
SHA40 = re.compile(r"[0-9a-f]{40}\Z")
SHA256 = re.compile(r"sha256:[0-9a-f]{64}\Z")
BLOB = re.compile(r"blobs/sha256/([0-9a-f]{64})\Z")
STATIC_ROOT = "usr/share/nginx/html"
# These root names can give a Pages direct upload code/config authority. Ordinary
# client-side JavaScript and reviewed static metadata (including _routes.json)
# remain valid site assets.
DYNAMIC_ROOTS = frozenset({"_worker.js", "functions", ".wrangler", "wrangler.toml", "wrangler.json", "wrangler.jsonc"})
MAX_ARCHIVE = 512 * 1024 * 1024
MAX_OUTER_MEMBERS = 128
MAX_BLOB = 384 * 1024 * 1024
MAX_JSON = 1024 * 1024
MAX_LAYER_UNCOMPRESSED = 1024 * 1024 * 1024
MAX_STATIC_FILES = 20000
MAX_STATIC_ENTRIES = 50000
MAX_STATIC_FILE = 128 * 1024 * 1024
MAX_STATIC_BYTES = 768 * 1024 * 1024
MAX_PATH_BYTES = 4096
MAX_PATH_DEPTH = 64
CHUNK = 1024 * 1024


class ArtifactError(Exception):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ArtifactError(message)


def canonical(name: str, directory: bool = False) -> str:
    if directory and name.endswith("/"):
        name = name[:-1]
    require(bool(name) and not name.startswith("/") and "\\" not in name, "noncanonical archive path")
    require(all(part not in ("", ".", "..") for part in name.split("/")), "noncanonical archive path")
    require(not any(ord(char) < 32 or ord(char) == 127 for char in name), "control in archive path")
    try:
        encoded = name.encode("utf-8", "strict")
    except UnicodeEncodeError as exc:
        raise ArtifactError("non-UTF-8 archive path") from exc
    require(len(encoded) <= MAX_PATH_BYTES and name.count("/") < MAX_PATH_DEPTH, "archive path exceeds limit")
    return name


def read_bounded(stream, limit: int) -> bytes:
    data = stream.read(limit + 1)
    require(len(data) <= limit, "metadata exceeds size limit")
    return data


def json_object(data: bytes, label: str):
    try:
        value = json.loads(data, object_pairs_hook=unique_keys)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ArtifactError(f"invalid {label} JSON") from exc
    require(isinstance(value, dict), f"{label} must be an object")
    return value


def unique_keys(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, "duplicate JSON key")
        value[key] = item
    return value


def digest_stream(stream, limit: int) -> tuple[str, int]:
    digest = hashlib.sha256()
    count = 0
    while block := stream.read(CHUNK):
        count += len(block)
        require(count <= limit, "stream exceeds size limit")
        digest.update(block)
    return "sha256:" + digest.hexdigest(), count


class DigestReader:
    def __init__(self, stream, limit: int):
        self.stream = stream
        self.limit = limit
        self.digest = hashlib.sha256()
        self.count = 0

    def read(self, size=-1):
        if size is None or size < 0:
            size = CHUNK
        block = self.stream.read(size)
        self.count += len(block)
        require(self.count <= self.limit, "uncompressed layer exceeds size limit")
        self.digest.update(block)
        return block

    def finish(self) -> str:
        while self.read(CHUNK):
            pass
        return "sha256:" + self.digest.hexdigest()


def load_metadata(path: Path, args) -> dict:
    require(path.is_file() and not path.is_symlink(), "metadata must be a regular file")
    require(path.stat().st_size <= MAX_JSON, "metadata exceeds size limit")
    metadata = json_object(path.read_bytes(), "source metadata")
    sha = args.expected_source_sha
    require(SHA40.fullmatch(sha) is not None, "expected source SHA is malformed")
    require(args.expected_repository == REPOSITORY, "unexpected source repository")
    require(args.expected_pr > 0 and args.expected_run_id > 0 and args.expected_run_attempt > 0, "invalid expected identity")
    expected_tag = f"shadow-pr-{args.expected_pr}-{sha[:12]}-amd64"
    checks = {
        "schemaVersion": 2,
        "repository": REPOSITORY,
        "eventName": "repository_dispatch",
        "sourceSha": sha,
        "prNumber": args.expected_pr,
        "imageTag": expected_tag,
        "sourceRunner": "ubuntu-latest",
        "sourceWorkflowRunId": args.expected_run_id,
        "sourceWorkflowRunAttempt": args.expected_run_attempt,
    }
    for key, expected in checks.items():
        require(type(metadata.get(key)) is type(expected) and metadata[key] == expected, f"source metadata {key} mismatch")
    require(SHA256.fullmatch(metadata.get("archiveDigest", "")) is not None, "invalid archive digest")
    return metadata


def outer_members(archive: tarfile.TarFile) -> dict[str, tarfile.TarInfo]:
    members = {}
    for member in archive:
        require(len(members) < MAX_OUTER_MEMBERS, "too many outer archive entries")
        require(member.isfile() or member.isdir(), "outer archive link or special entry")
        name = canonical(member.name, member.isdir())
        require(name not in members, "duplicate outer archive path")
        require(member.size >= 0 and member.size <= MAX_BLOB, "outer member exceeds size limit")
        require(name in {"blobs", "blobs/sha256", "manifest.json", "index.json", "oci-layout"} or BLOB.fullmatch(name), "unexpected outer archive path")
        require(member.isdir() == (name in {"blobs", "blobs/sha256"}), "unexpected outer archive entry type")
        members[name] = member
    require({"manifest.json", "index.json", "oci-layout"} <= members.keys(), "missing OCI metadata")
    return members


def member_bytes(archive, members, name, limit=MAX_JSON):
    require(name in members and members[name].isfile(), f"missing {name}")
    require(members[name].size <= limit, f"{name} exceeds size limit")
    stream = archive.extractfile(members[name])
    require(stream is not None, f"unreadable {name}")
    with stream:
        return read_bounded(stream, limit)


def image_layout(archive, members, metadata):
    layout = json_object(member_bytes(archive, members, "oci-layout"), "OCI layout")
    require(layout.get("imageLayoutVersion") == "1.0.0", "unsupported OCI layout")
    docker = json.loads(member_bytes(archive, members, "manifest.json"), object_pairs_hook=unique_keys)
    require(isinstance(docker, list) and len(docker) == 1 and isinstance(docker[0], dict), "expected one Docker manifest")
    docker = docker[0]
    require(docker.get("RepoTags") == ["shadow-source:" + metadata["imageTag"]], "Docker image tag mismatch")
    config_path = docker.get("Config")
    layer_paths = docker.get("Layers")
    require(isinstance(config_path, str) and BLOB.fullmatch(config_path), "invalid config path")
    require(isinstance(layer_paths, list) and 1 <= len(layer_paths) <= 64, "invalid layer list")
    require(all(isinstance(path, str) and BLOB.fullmatch(path) for path in layer_paths), "invalid layer path")
    require(len(set(layer_paths)) == len(layer_paths) and config_path not in layer_paths, "duplicate image blob")

    index = json_object(member_bytes(archive, members, "index.json"), "OCI index")
    require(index.get("schemaVersion") == 2 and index.get("mediaType") == "application/vnd.oci.image.index.v1+json", "invalid OCI index")
    descriptors = index.get("manifests")
    require(isinstance(descriptors, list) and len(descriptors) == 1, "expected one OCI platform")
    descriptor = descriptors[0]
    require(descriptor.get("platform") == {"architecture": "amd64", "os": "linux"}, "image platform mismatch")
    require(descriptor.get("mediaType") == "application/vnd.oci.image.manifest.v1+json", "invalid OCI manifest type")
    oci_manifest_path = blob_path(descriptor.get("digest"))
    oci_manifest_bytes = member_bytes(archive, members, oci_manifest_path)
    require(len(oci_manifest_bytes) == descriptor.get("size"), "OCI manifest size mismatch")
    manifest = json_object(oci_manifest_bytes, "OCI manifest")
    require(manifest.get("schemaVersion") == 2 and manifest.get("mediaType") == "application/vnd.oci.image.manifest.v1+json", "invalid OCI manifest")
    config_descriptor = manifest.get("config")
    require(isinstance(config_descriptor, dict) and config_descriptor.get("mediaType") == "application/vnd.oci.image.config.v1+json", "invalid OCI config descriptor")
    require(blob_path(config_descriptor.get("digest")) == config_path, "OCI/Docker config mismatch")
    require(config_descriptor.get("size") == members[config_path].size, "OCI config size mismatch")
    layers = manifest.get("layers")
    require(isinstance(layers, list) and len(layers) == len(layer_paths), "OCI/Docker layer count mismatch")
    for descriptor, path in zip(layers, layer_paths):
        require(isinstance(descriptor, dict), "invalid layer descriptor")
        require(blob_path(descriptor.get("digest")) == path, "OCI/Docker layer order mismatch")
        require(descriptor.get("size") == members[path].size, "OCI layer size mismatch")
        require(descriptor.get("mediaType") in ("application/vnd.oci.image.layer.v1.tar+gzip", "application/vnd.oci.image.layer.v1.tar"), "unsupported layer media type")

    config = json_object(member_bytes(archive, members, config_path), "image config")
    require(config.get("os") == "linux" and config.get("architecture") == "amd64", "config platform mismatch")
    labels = config.get("config", {}).get("Labels", {})
    require(isinstance(labels, dict) and labels.get("org.opencontainers.image.revision") == metadata["sourceSha"], "image revision mismatch")
    rootfs = config.get("rootfs", {})
    diff_ids = rootfs.get("diff_ids")
    require(rootfs.get("type") == "layers" and isinstance(diff_ids, list) and len(diff_ids) == len(layers), "invalid ordered diff IDs")
    require(all(isinstance(digest, str) and SHA256.fullmatch(digest) for digest in diff_ids), "invalid diff ID")
    history = config.get("history")
    require(isinstance(history, list), "missing image history")
    changes = [entry for entry in history if isinstance(entry, dict) and not entry.get("empty_layer")]
    require(len(changes) == len(layers), "history/layer order mismatch")
    require(re.fullmatch(r"COPY (?:--chown=[^ ]+ )?/build/build /usr/share/nginx/html # buildkit", changes[-1].get("created_by", "")) is not None, "last image layer is not the static COPY")
    expected_blobs = {config_path, oci_manifest_path, *layer_paths}
    actual_blobs = {name for name in members if BLOB.fullmatch(name)}
    require(actual_blobs == expected_blobs, "unreferenced or missing archive blob")
    return layer_paths, layers, diff_ids


def blob_path(digest):
    require(isinstance(digest, str) and SHA256.fullmatch(digest), "invalid blob digest")
    return "blobs/sha256/" + digest[7:]


def verify_blobs(archive, members):
    for name, member in members.items():
        if not BLOB.fullmatch(name):
            continue
        with archive.extractfile(member) as stream:
            actual, size = digest_stream(stream, MAX_BLOB)
        require(size == member.size and actual == "sha256:" + name.rsplit("/", 1)[1], f"blob digest mismatch: {name}")


class StaticExtractor:
    def __init__(self, output: Path, source_sha: str):
        self.output = output
        self.sha = source_sha
        self.paths = set()
        self.files = []
        self.total = 0
        self.html = 0

    def process(self, member: tarfile.TarInfo, archive: tarfile.TarFile):
        require(member.isfile() or member.isdir(), "static layer link or special entry")
        require(len(self.paths) < MAX_STATIC_ENTRIES, "too many static layer entries")
        name = canonical(member.name, member.isdir())
        require(name not in self.paths, "duplicate static layer path")
        self.paths.add(name)
        require(not any(part.startswith(".wh.") for part in name.split("/")), "whiteout in static layer")
        if member.isdir() and (STATIC_ROOT == name or STATIC_ROOT.startswith(name + "/")):
            return
        require(name.startswith(STATIC_ROOT + "/"), "static COPY layer contains a file outside site root")
        relative = name[len(STATIC_ROOT) + 1 :]
        require(relative, "empty site path")
        require(relative.split("/", 1)[0] not in DYNAMIC_ROOTS, "Pages code or configuration payload in static layer")
        destination = self.output.joinpath(*relative.split("/"))
        if member.isdir():
            require(not destination.exists(), "duplicate or conflicting site directory")
            destination.mkdir(parents=True, exist_ok=False)
            return
        require(member.size <= MAX_STATIC_FILE, "static file exceeds size limit")
        require(len(self.files) < MAX_STATIC_FILES, "too many static files")
        self.total += member.size
        require(self.total <= MAX_STATIC_BYTES, "static payload exceeds size limit")
        require(not destination.exists(), "duplicate or conflicting site file")
        destination.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        robots = b'<meta name="robots" content="noindex,nofollow" data-deploy-tier="shadow"'
        source_sha = f'<meta name="tinyland-source-sha" content="{self.sha}" data-deploy-tier="shadow"'.encode()
        marker = bytearray() if relative.lower().endswith(".html") else None
        found_robots = found_source = False
        source = archive.extractfile(member)
        require(source is not None, "unreadable static file")
        with source, destination.open("xb") as target:
            remaining = member.size
            while remaining:
                block = source.read(min(CHUNK, remaining))
                require(block, "truncated static file")
                remaining -= len(block)
                digest.update(block)
                target.write(block)
                if marker is not None:
                    marker.extend(block)
                    found_robots |= robots in marker
                    found_source |= source_sha in marker
                    del marker[: max(0, len(marker) - max(len(robots), len(source_sha)))]
        if marker is not None:
            require(found_robots and found_source, f"shadow markers missing or stale: {relative}")
            self.html += 1
        self.files.append((relative, member.size, digest.hexdigest()))

    def receipt(self, metadata, archive_digest):
        require(self.files and self.html, "static site contains no HTML")
        aggregate = hashlib.sha256()
        for name, size, digest in sorted(self.files):
            aggregate.update(json.dumps([name, size, digest], ensure_ascii=False, separators=(",", ":")).encode("utf-8") + b"\n")
        return {
            "schemaVersion": 1,
            "repository": REPOSITORY,
            "prNumber": metadata["prNumber"],
            "sourceSha": self.sha,
            "sourceWorkflowRunId": metadata["sourceWorkflowRunId"],
            "sourceWorkflowRunAttempt": metadata["sourceWorkflowRunAttempt"],
            "archiveDigest": archive_digest,
            "imageTag": metadata["imageTag"],
            "extractedFileCount": len(self.files),
            "htmlCount": self.html,
            "contentDigest": "sha256:" + aggregate.hexdigest(),
            "outputDir": str(self.output),
            "files": [{"path": name, "size": size, "sha256": digest} for name, size, digest in sorted(self.files)],
        }


def verify_layers(archive, members, layer_paths, descriptors, diff_ids, extractor):
    for index, (path, descriptor, expected) in enumerate(zip(layer_paths, descriptors, diff_ids)):
        compressed = archive.extractfile(members[path])
        require(compressed is not None, "unreadable image layer")
        with compressed:
            media = descriptor["mediaType"]
            stream = gzip.GzipFile(fileobj=compressed) if media.endswith("+gzip") else compressed
            with stream:
                hashed = DigestReader(stream, MAX_LAYER_UNCOMPRESSED)
                if index == len(layer_paths) - 1:
                    with tarfile.open(fileobj=hashed, mode="r|") as layer:
                        for member in layer:
                            extractor.process(member, layer)
                actual = hashed.finish()
                require(actual == expected, f"uncompressed layer diff ID mismatch at index {index}")


def require_case_sensitive_destination(output: Path):
    """The reviewed site intentionally has names differing only by case."""
    lower = output / ".__shadow_case_probe_aa__"
    upper = output / ".__shadow_case_probe_AA__"
    with lower.open("xb"):
        pass
    try:
        require(not upper.exists(), "case-insensitive output filesystem")
    finally:
        lower.unlink()


def verify(args):
    archive_path = Path(args.archive).absolute()
    metadata_path = Path(args.metadata).absolute()
    output = Path(args.output_dir).absolute()
    receipt_path = Path(args.receipt).absolute()
    require(archive_path.is_file() and not archive_path.is_symlink(), "archive must be a regular file")
    require(output != receipt_path and output not in receipt_path.parents, "receipt must be outside output directory")
    require(not output.exists() and not output.is_symlink(), "output directory must not exist")
    require(not receipt_path.exists() and not receipt_path.is_symlink(), "receipt must not exist")
    require(output.parent.is_dir() and receipt_path.parent.is_dir(), "output and receipt parents must exist")
    require(archive_path.stat().st_size <= MAX_ARCHIVE, "archive exceeds size limit")
    metadata = load_metadata(metadata_path, args)
    with archive_path.open("rb") as stream:
        archive_digest, _ = digest_stream(stream, MAX_ARCHIVE)
    require(archive_digest == metadata["archiveDigest"], "archive SHA-256 mismatch")
    created = False
    try:
        with tarfile.open(archive_path, mode="r:") as archive:
            members = outer_members(archive)
            layer_paths, descriptors, diff_ids = image_layout(archive, members, metadata)
            verify_blobs(archive, members)
            output.mkdir(mode=0o700)
            created = True
            require_case_sensitive_destination(output)
            extractor = StaticExtractor(output, metadata["sourceSha"])
            verify_layers(archive, members, layer_paths, descriptors, diff_ids, extractor)
            receipt = extractor.receipt(metadata, archive_digest)
        with receipt_path.open("x", encoding="utf-8") as stream:
            json.dump(receipt, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
        print(json.dumps({key: receipt[key] for key in ("sourceSha", "archiveDigest", "extractedFileCount", "htmlCount", "contentDigest")}, sort_keys=True))
    except Exception:
        if created:
            shutil.rmtree(output)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("archive", "metadata", "expected-repository", "expected-pr", "expected-source-sha", "expected-run-id", "expected-run-attempt", "output-dir", "receipt"):
        parser.add_argument("--" + name, required=True, type=int if name in ("expected-pr", "expected-run-id", "expected-run-attempt") else str)
    args = parser.parse_args()
    try:
        verify(args)
    except (ArtifactError, OSError, tarfile.TarError, EOFError, gzip.BadGzipFile, ValueError) as exc:
        print(f"shadow artifact rejected: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
