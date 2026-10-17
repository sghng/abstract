---
name: cluster
description: >-
  Notre Dame CRC cluster access and job submission. Use whenever running
  or preparing compute on the CRC (training, simulations, compilation,
  benchmarks, moving data).
---

# Skill: cluster

# CRC (Notre Dame Center for Research Computing)

Docs at `docs.crc.nd.edu` (context7 `/websites/crc_nd_edu`).

## Access

- `ssh crc '<cmd>'` runs on the frontend. Use it for burst compute,
  smoke tests, compilation, benchmarks. Minutes-scale work only, the
  frontend is shared.
- Real computation (hours-scale simulation, training) goes through the
  queue, `qsub` via the same alias.
- Scripts go as `ssh crc bash -s < script.sh` (the login shell is fish).
  The banner `Loading CRC_default/1.1` rides stderr, stdout is clean.
- If `ssh crc` fails fast, `systemctl --user restart crc-keeper`.

## Batch jobs

```sh
#!/bin/bash
#$ -q long               # cpu; gpu for GPU jobs
#$ -l gpu_card=1         # gpu queue only
#$ -pe smp 8             # cores
#$ -l h_rt=24:00:00      # walltime cap, 96h max on gpu
#$ -N job_name
#$ -j y
#$ -o out.log
cd /groups/cliu7/ghuang3/<project>
/absolute/venv/bin/python script.py
```

- Submit `ssh crc 'cd <dir> && qsub job.sh'`, watch `qstat -u ghuang3`,
  cancel `qdel <id>`.
- Record every submitted job in the project's `notes/cluster-jobs.md`
  (date, jobid, name, purpose), update status when checked.
- Fair-share scheduler. After heavy lab usage new jobs wait minutes to
  hours even with capacity free. Wait, don't resubmit duplicates,
  `qdel` stale jobs.
- GPU quota is 4 cards per user.

## Storage and environment

- Queued research jobs live under `/groups/cliu7/ghuang3/<project>/`.
  Misc burst output in `$HOME` is fine.
- Python via a uv venv in the group dir, absolute python path in job
  scripts (`uv venv --python 3.12`, the system python is too new).
