#!/usr/bin/env python3
"""Verify a tier-filtered build contains only the expected features.

Thin wrapper around the monorepo-tier-filter package.
See packages/monorepo-tier-filter/ for the extracted library.
"""
from monorepo_tier_filter.verify_tier_build import main

if __name__ == "__main__":
    import sys
    sys.exit(main())
