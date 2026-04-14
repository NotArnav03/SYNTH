#!/bin/bash
# Start all SYNTH services
set -e

export PYTHONPATH="${PYTHONPATH:-$(pwd)}"

echo "Starting SYNTH Protocol..."
python -m agents.web_research.main &
python -m agents.doc_analysis.main &
python -m agents.code_review.main &
python -m agents.synthesis.main &
sleep 2  # Let agents start before router tries to accept registrations
python -m router.main
