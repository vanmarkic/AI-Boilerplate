#!/usr/bin/env python3
"""Filter features by tier for build-time exclusion.

Thin wrapper around the monorepo-tier-filter package.
See packages/monorepo-tier-filter/ for the extracted library.
"""
from monorepo_tier_filter.filter_features import main

if __name__ == "__main__":
    import sys
    sys.exit(main())
