"""Where //projection takes the xoxd_projection module from (TIN-8654)."""

# The registry module xoxd_projection 1.0.0, a bazel_dep in MODULE.bazel.
# projection/check-no-temporary-override.mjs fails CI if this points anywhere
# else, such as a vendored copy.
XOXD_PROJECTION = "@xoxd_projection//"
