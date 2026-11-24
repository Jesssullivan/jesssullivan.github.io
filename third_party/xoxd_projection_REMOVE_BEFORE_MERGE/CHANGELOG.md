# Changelog

## 1.0.0 (unreleased)

First release (TIN-8620). The consumer side of `xoxd-projection/v2`: a
verifier for signed hub manifests, the canonical-v0 approval hash, a fetcher
that writes a site's projection directory, and the `//:fetch` command. It
passes the contract fixtures and canonical-v0 vectors of commit `d91134c54`.
The package ships JavaScript in `dist/`, so it loads from `node_modules` on
Node 22 and newer. A build at the `seq` built last must name the manifest
built last, read from the receipt.
