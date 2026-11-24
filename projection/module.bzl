"""Where //projection takes the xoxd_projection module from (TIN-8654)."""

# TEMPORARY, DRAFT ONLY. The vendored copy stands in for the registry module
# until xoxd_projection 1.0.0 is released (TIN-8643). Before merge this line
# becomes XOXD_PROJECTION = "@xoxd_projection//" and MODULE.bazel gains
# bazel_dep(name = "xoxd_projection", version = "1.0.0").
XOXD_PROJECTION = "//third_party/xoxd_projection_REMOVE_BEFORE_MERGE"
