"""Adversarial, self-contained fixtures for the source-only Pages extractor."""

from __future__ import annotations

import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import tarfile
import tempfile
import unittest
from unittest import mock


SCRIPT = Path(__file__).with_name("shadow-pages-artifact.py")
SPEC = importlib.util.spec_from_file_location("shadow_pages_artifact", SCRIPT)
artifact = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(artifact)
SHA = "b3dd49151a3966fc922d28507b22ccab3dc4fc7d"
TAG = f"shadow-pr-280-{SHA[:12]}-amd64"
HTML = (
    b'<html><head><meta name="robots" content="noindex,nofollow" data-deploy-tier="shadow">'
    + f'<meta name="tinyland-source-sha" content="{SHA}" data-deploy-tier="shadow">'.encode()
    + b"</head><body>shadow</body></html>"
)


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def digest(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


def add_file(tar, name, payload, kind="file"):
    entry = tarfile.TarInfo(name)
    if kind == "dir":
        entry.type = tarfile.DIRTYPE
        entry.size = 0
        tar.addfile(entry)
    elif kind == "link":
        entry.type = tarfile.SYMTYPE
        entry.linkname = "../escape"
        tar.addfile(entry)
    else:
        entry.size = len(payload)
        tar.addfile(entry, io.BytesIO(payload))


def layer_bytes(entries):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as tar:
        for name, payload, kind in entries:
            add_file(tar, name, payload, kind)
    return buffer.getvalue()


def fixture(directory, *, final_entries=None, wrong_platform=False, reverse_diff_ids=False,
            wrong_layer_size=False, corrupt_blob=False, outer_extra=None):
    base = layer_bytes([("usr/share/nginx/html/50x.html", b"inherited nginx error", "file")])
    if final_entries is None:
        final_entries = [("usr/share/nginx/html/index.html", HTML, "file")]
    final = layer_bytes(final_entries)
    raw = [base, final]
    compressed = [gzip.compress(layer, mtime=0) for layer in raw]
    diff_ids = [digest(layer) for layer in raw]
    if reverse_diff_ids:
        diff_ids.reverse()
    config = encoded({
        "os": "linux", "architecture": "amd64",
        "config": {"Labels": {"org.opencontainers.image.revision": SHA}},
        "rootfs": {"type": "layers", "diff_ids": diff_ids},
        "history": [
            {"created_by": "COPY base /usr/share/nginx/html # buildkit"},
            {"created_by": "COPY --chown=nginx:nginx /build/build /usr/share/nginx/html # buildkit"},
        ],
    })
    layers = [
        {"mediaType": "application/vnd.oci.image.layer.v1.tar+gzip", "digest": digest(blob),
         "size": len(blob) + (1 if wrong_layer_size and index == 1 else 0)}
        for index, blob in enumerate(compressed)
    ]
    oci_manifest = encoded({
        "schemaVersion": 2, "mediaType": "application/vnd.oci.image.manifest.v1+json",
        "config": {"mediaType": "application/vnd.oci.image.config.v1+json",
                   "digest": digest(config), "size": len(config)},
        "layers": layers,
    })
    index = encoded({
        "schemaVersion": 2, "mediaType": "application/vnd.oci.image.index.v1+json",
        "manifests": [{"mediaType": "application/vnd.oci.image.manifest.v1+json",
                       "digest": digest(oci_manifest), "size": len(oci_manifest),
                       "platform": {"architecture": "arm64" if wrong_platform else "amd64", "os": "linux"}}],
    })
    docker_manifest = encoded([{
        "Config": "blobs/sha256/" + digest(config)[7:],
        "RepoTags": ["shadow-source:" + TAG],
        "Layers": ["blobs/sha256/" + layer["digest"][7:] for layer in layers],
    }])
    blobs = [oci_manifest, config, *compressed]
    archive_path = directory / "shadow-source.tar"
    with tarfile.open(archive_path, "w") as tar:
        for name in ("blobs", "blobs/sha256"):
            add_file(tar, name, b"", "dir")
        for index_, blob in enumerate(blobs):
            if corrupt_blob and index_ == len(blobs) - 1:
                blob = blob[:-1] + bytes([blob[-1] ^ 1])
            add_file(tar, "blobs/sha256/" + digest(blobs[index_])[7:], blob)
        add_file(tar, "index.json", index)
        add_file(tar, "manifest.json", docker_manifest)
        add_file(tar, "oci-layout", encoded({"imageLayoutVersion": "1.0.0"}))
        if outer_extra:
            add_file(tar, *outer_extra)
    metadata = {
        "schemaVersion": 2, "repository": artifact.REPOSITORY,
        "eventName": "repository_dispatch", "sourceSha": SHA,
        "prNumber": 280, "imageTag": TAG, "sourceRunner": "ubuntu-latest",
        "sourceWorkflowRunId": 36102157173, "sourceWorkflowRunAttempt": 1,
        "archiveDigest": digest(archive_path.read_bytes()),
    }
    metadata_path = directory / "shadow-source-metadata.json"
    metadata_path.write_bytes(encoded(metadata))
    return archive_path, metadata_path


def args(directory):
    return SimpleNamespace(
        archive=str(directory / "shadow-source.tar"),
        metadata=str(directory / "shadow-source-metadata.json"),
        expected_repository=artifact.REPOSITORY,
        expected_pr=280,
        expected_source_sha=SHA,
        expected_run_id=36102157173,
        expected_run_attempt=1,
        output_dir=str(directory / "site"),
        receipt=str(directory / "receipt.json"),
    )


class ArtifactFixtureTests(unittest.TestCase):
    def run_fixture(self, **changes):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        directory = Path(temp.name)
        fixture(directory, **changes)
        return directory, args(directory)

    def rejects(self, expected, **changes):
        directory, options = self.run_fixture(**changes)
        with self.assertRaisesRegex(artifact.ArtifactError, expected):
            artifact.verify(options)
        self.assertFalse((directory / "site").exists())
        self.assertFalse((directory / "receipt.json").exists())

    def test_valid_copy_excludes_inherited_nginx_50x(self):
        directory, options = self.run_fixture()
        artifact.verify(options)
        self.assertEqual((directory / "site/index.html").read_bytes(), HTML)
        self.assertFalse((directory / "site/50x.html").exists())
        receipt = json.loads((directory / "receipt.json").read_text())
        self.assertEqual((receipt["extractedFileCount"], receipt["htmlCount"]), (1, 1))
        self.assertEqual(receipt["files"][0]["path"], "index.html")

    def test_archive_digest_mismatch(self):
        directory, options = self.run_fixture()
        options.expected_run_attempt = 2
        with self.assertRaisesRegex(artifact.ArtifactError, "source metadata sourceWorkflowRunAttempt"):
            artifact.verify(options)
        options.expected_run_attempt = 1
        metadata_path = directory / "shadow-source-metadata.json"
        metadata = json.loads(metadata_path.read_text())
        metadata["archiveDigest"] = "sha256:" + "0" * 64
        metadata_path.write_bytes(encoded(metadata))
        with self.assertRaisesRegex(artifact.ArtifactError, "archive SHA-256 mismatch"):
            artifact.verify(options)

    def test_wrong_source_sha(self):
        directory, options = self.run_fixture()
        options.expected_source_sha = "a" * 40
        with self.assertRaisesRegex(artifact.ArtifactError, "source metadata sourceSha"):
            artifact.verify(options)

    def test_wrong_repository_and_pr(self):
        directory, options = self.run_fixture()
        options.expected_repository = "attacker/repo"
        with self.assertRaisesRegex(artifact.ArtifactError, "unexpected source repository"):
            artifact.verify(options)
        options.expected_repository = artifact.REPOSITORY
        options.expected_pr = 281
        with self.assertRaisesRegex(artifact.ArtifactError, "source metadata prNumber"):
            artifact.verify(options)

    def test_blob_digest(self):
        self.rejects("blob digest mismatch", corrupt_blob=True)

    def test_ordered_uncompressed_diff_ids(self):
        self.rejects("diff ID mismatch", reverse_diff_ids=True)

    def test_wrong_platform(self):
        self.rejects("image platform mismatch", wrong_platform=True)

    def test_descriptor_size(self):
        self.rejects("OCI layer size mismatch", wrong_layer_size=True)

    def test_outer_traversal_absolute_link_and_duplicate(self):
        for extra, error in (
            (("../escape", b"x", "file"), "noncanonical archive path"),
            (("/absolute", b"x", "file"), "noncanonical archive path"),
            (("outside", b"", "link"), "outer archive link"),
            (("index.json", b"{}", "file"), "duplicate outer archive path"),
        ):
            with self.subTest(extra=extra[0]):
                self.rejects(error, outer_extra=extra)

    def test_static_traversal_absolute_link_duplicate_whiteout(self):
        good = ("usr/share/nginx/html/index.html", HTML, "file")
        for entries, error in (
            ([good, ("usr/share/nginx/html/../escape", b"x", "file")], "noncanonical archive path"),
            ([good, ("/usr/share/nginx/html/escape", b"x", "file")], "noncanonical archive path"),
            ([good, ("usr/share/nginx/html/link", b"", "link")], "static layer link"),
            ([good, good], "duplicate static layer path"),
            ([good, ("usr/share/nginx/html/.wh.index.html", b"", "file")], "whiteout"),
        ):
            with self.subTest(error=error):
                self.rejects(error, final_entries=entries)

    def test_pages_code_and_configuration_payloads_are_never_extracted(self):
        good = ("usr/share/nginx/html/index.html", HTML, "file")
        for name, kind in (
            ("_worker.js", "file"), ("_worker.js/", "dir"), ("_worker.js/entry.js", "file"),
            ("functions/", "dir"), ("functions/route.js", "file"),
            (".wrangler/", "dir"), (".wrangler/state.json", "file"),
            ("wrangler.toml", "file"), ("wrangler.json", "file"), ("wrangler.jsonc", "file"),
        ):
            with self.subTest(name=name):
                self.rejects("Pages code or configuration payload", final_entries=[
                    good, ("usr/share/nginx/html/" + name, b"export default {}", kind),
                ])

    def test_explicit_ordered_directories(self):
        directory, options = self.run_fixture(final_entries=[
            ("usr/", b"", "dir"),
            ("usr/share/", b"", "dir"),
            ("usr/share/nginx/", b"", "dir"),
            ("usr/share/nginx/html/", b"", "dir"),
            ("usr/share/nginx/html/posts/", b"", "dir"),
            ("usr/share/nginx/html/posts/index.html", HTML, "file"),
            ("usr/share/nginx/html/_routes.json", b'{"version":1,"include":[],"exclude":[]}', "file"),
        ])
        artifact.verify(options)
        self.assertEqual((directory / "site/posts/index.html").read_bytes(), HTML)
        self.assertTrue((directory / "site/_routes.json").is_file())

    def test_case_distinct_paths_are_preserved_on_linux(self):
        directory, options = self.run_fixture(final_entries=[
            ("usr/share/nginx/html/index.html", HTML, "file"),
            ("usr/share/nginx/html/Foo/one.txt", b"1", "file"),
            ("usr/share/nginx/html/foo/two.txt", b"2", "file"),
        ])
        artifact.verify(options)
        self.assertEqual((directory / "site/Foo/one.txt").read_bytes(), b"1")
        self.assertEqual((directory / "site/foo/two.txt").read_bytes(), b"2")

    def test_case_insensitive_destination_rejected(self):
        directory, options = self.run_fixture()
        with mock.patch.object(artifact, "require_case_sensitive_destination", side_effect=artifact.ArtifactError("case-insensitive output filesystem")):
            with self.assertRaisesRegex(artifact.ArtifactError, "case-insensitive output filesystem"):
                artifact.verify(options)
        self.assertFalse((directory / "site").exists())

    def test_wrong_tier_or_missing_html_markers(self):
        self.rejects("shadow markers", final_entries=[
            ("usr/share/nginx/html/index.html", HTML.replace(b'data-deploy-tier="shadow"', b'data-deploy-tier="production"'), "file"),
        ])
        self.rejects("shadow markers", final_entries=[
            ("usr/share/nginx/html/index.html", b"<html>not stamped</html>", "file"),
        ])
        self.rejects("shadow markers", final_entries=[
            ("usr/share/nginx/html/index.html", HTML.replace(SHA.encode(), b"0" * 40), "file"),
        ])

    def test_limits_and_exclusive_destinations(self):
        directory, options = self.run_fixture()
        with mock.patch.object(artifact, "MAX_ARCHIVE", 100):
            with self.assertRaisesRegex(artifact.ArtifactError, "archive exceeds size limit"):
                artifact.verify(options)
        with mock.patch.object(artifact, "MAX_STATIC_FILE", 10):
            with self.assertRaisesRegex(artifact.ArtifactError, "static file exceeds"):
                artifact.verify(options)
        with mock.patch.object(artifact, "MAX_STATIC_FILES", 0):
            with self.assertRaisesRegex(artifact.ArtifactError, "too many static files"):
                artifact.verify(options)
        with mock.patch.object(artifact, "MAX_OUTER_MEMBERS", 2):
            with self.assertRaisesRegex(artifact.ArtifactError, "too many outer archive entries"):
                artifact.verify(options)
        self.assertFalse((directory / "site").exists())
        (directory / "site").mkdir()
        with self.assertRaisesRegex(artifact.ArtifactError, "output directory must not exist"):
            artifact.verify(options)


if __name__ == "__main__":
    unittest.main()
