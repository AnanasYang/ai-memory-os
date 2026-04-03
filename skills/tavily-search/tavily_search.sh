#!/bin/bash
# Wrapper script for Tavily search functionality

export TAVILY_API_KEY="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"

if [ $# -eq 0 ]; then
    echo "Usage: $0 \"search query\" [number of results]"
    echo "Example: $0 \"英伟达最新动态\" 5"
    exit 1
fi

QUERY="$1"
NUM_RESULTS="${2:-5}"  # Default to 5 if not specified

node /home/bruce/.openclaw/workspace/skills/tavily-search/scripts/search.mjs "$QUERY" -n $NUM_RESULTS