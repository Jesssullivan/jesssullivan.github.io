"""Forward a registry module's npm package without its own dependency links.

npm_replace_package swaps a pnpm-lock package for a registry module's
`npm_package` target (RU9). rules_js then links the lock's resolved deps of
that package AND the deps carried in the replacement's
NpmPackageInfo.npm_package_store_infos (the module's own node_modules) into the
same package store directory. When both name the same package (for
vite-plugin-a11y: magic-string and vite), Bazel reports conflicting
UnresolvedSymlink actions. This rule re-exports the module's built package
directory with no store infos, so only the lock's deps are linked, exactly as
for any npm package from the registry.
"""

load("@aspect_rules_js//npm:providers.bzl", "NpmPackageInfo")

def _npm_house_package_impl(ctx):
    info = ctx.attr.src[NpmPackageInfo]
    return [
        DefaultInfo(files = depset([info.src])),
        NpmPackageInfo(
            package = info.package,
            version = info.version,
            src = info.src,
            npm_package_store_infos = depset(),
        ),
    ]

npm_house_package = rule(
    implementation = _npm_house_package_impl,
    attrs = {
        "src": attr.label(
            mandatory = True,
            providers = [NpmPackageInfo],
            doc = "A registry module's npm_package target, for example @tummycrypt_vite_plugin_a11y//:pkg.",
        ),
    },
    doc = "Re-exports an npm_package's directory without the npm_package_store_infos of its own build graph.",
)
