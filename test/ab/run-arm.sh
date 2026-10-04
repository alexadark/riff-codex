#!/bin/zsh
# Compares the main-branch skills (old) with this branch (new) on the same fixture, headless.
# Usage: run-arm.sh <old|new> <wave|quick> <run-number>; then node analyze.mjs
set -e
AB=${0:A:h}
arm=$1 skill=$2 n=$3
case $arm in
  old) FW=/Users/webstantly/DEV/frameworks/riff-codex/riff ;;
  new) FW=/Users/webstantly/DEV/frameworks/riff-codex-phase2/riff ;;
esac
dir=$AB/runs/$skill-$arm-$n
rm -rf $dir && mkdir -p $dir && cp -R $AB/template $dir/project
cd $dir/project
git init -q && git add -A && git -c user.name=T -c user.email=t@e.invalid commit -qm "Tasklist baseline"
HOME=$dir/fake-home node $FW/bin/riff.mjs init --project-root . --non-interactive --scope production --autonomy loop > $dir/init.log 2>&1
mkdir -p .claude/skills && ln -s $FW/skills/$skill .claude/skills/riff-$skill
printf '.claude/\n.agents/\n.codex/\n' >> .git/info/exclude
git rev-parse HEAD > $dir/base.txt
if [ $skill = wave ]; then
  prompt="Use the RIFF wave skill to build this project's roadmap. Autonomy is loop: work through every ready phase without asking me anything. Publication is not authorized: no push and no pull request."
else
  prompt="Use the RIFF quick skill for this change: the error for an empty task title should read 'Task title is required'. Publication is not authorized: no push and no pull request."
fi
export RIFF_IDEAS_FILE=$dir/ideas.ndjson
start=$(date +%s)
claude -p "$prompt" --model opus --effort medium --setting-sources project,local \
  --permission-mode acceptEdits --allowedTools "Bash Read Write Edit Glob Grep Agent Skill TodoWrite" \
  --output-format stream-json --verbose --no-session-persistence > $dir/stream.jsonl 2> $dir/stderr.log || echo "claude exit $?" >> $dir/stderr.log
echo $(( $(date +%s) - start )) > $dir/seconds.txt
