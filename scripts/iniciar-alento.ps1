./svc.sh statusl githubrunner
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
100  214M  100  214M    0     0  91.5M      0  0:00:02  0:00:02 --:--:-- 96.6M
actions-runner-linux-x64-2.334.0.tar.gz: OK

--------------------------------------------------------------------------------
|        ____ _ _   _   _       _          _        _   _                      |
|       / ___(_) |_| | | |_   _| |__      / \   ___| |_(_) ___  _ __  ___      |
|      | |  _| | __| |_| | | | | '_ \    / _ \ / __| __| |/ _ \| '_ \/ __|     |
|      | |_| | | |_|  _  | |_| | |_) |  / ___ \ (__| |_| | (_) | | | \__ \     |
|       \____|_|\__|_| |_|\__,_|_.__/  /_/   \_\___|\__|_|\___/|_| |_|___/     |
|                                                                              |
|                       Self-hosted runner registration                        |
|                                                                              |
--------------------------------------------------------------------------------

# Authentication


√ Connected to GitHub

# Runner Registration




√ Runner successfully added

# Runner settings


√ Settings Saved.

Creating launch runner in /etc/systemd/system/actions.runner.Eduardo-Alves20-ores.vps-ores.service
Run as user: githubrunner
Run as uid: 1000
gid: 1000
Created symlink /etc/systemd/system/multi-user.target.wants/actions.runner.Eduardo-Alves20-ores.vps-ores.service → /etc/systemd/system/actions.runner.Eduardo-Alves20-ores.vps-ores.service.

/etc/systemd/system/actions.runner.Eduardo-Alves20-ores.vps-ores.service
● actions.runner.Eduardo-Alves20-ores.vps-ores.service - GitHub Actions Runner (Eduardo-Alves20-ores.vps-ores)
     Loaded: loaded (/etc/systemd/system/actions.runner.Eduardo-Alves20-ores.vps-ores.service; enabled; preset: enabled)
     Active: active (running) since Thu 2026-04-30 16:32:39 -03; 14ms ago
   Main PID: 57847 (runsvc.sh)
      Tasks: 1 (limit: 4598)
     Memory: 1.1M (peak: 1.3M)
        CPU: 3ms
     CGroup: /system.slice/actions.runner.Eduardo-Alves20-ores.vps-ores.service
             ├─57847 /bin/bash /opt/actions-runner/runsvc.sh
             └─57855 /bin/bash /opt/actions-runner/runsvc.sh

Apr 30 16:32:39 sistemaores.vps-kinghost.net systemd[1]: Started actions.runner.Eduardo-Alves20-ores.vps-ores.ser…ores).
Hint: Some lines were ellipsized, use -l to show in full.

/etc/systemd/system/actions.runner.Eduardo-Alves20-ores.vps-ores.service
● actions.runner.Eduardo-Alves20-ores.vps-ores.service - GitHub Actions Runner (Eduardo-Alves20-ores.vps-ores)
     Loaded: loaded (/etc/systemd/system/actions.runner.Eduardo-Alves20-ores.vps-ores.service; enabled; preset: enabled)
     Active: active (running) since Thu 2026-04-30 16:32:39 -03; 32ms ago
   Main PID: 57847 (runsvc.sh)
      Tasks: 2 (limit: 4598)
     Memory: 1.3M (peak: 1.3M)
        CPU: 10ms
     CGroup: /system.slice/actions.runner.Eduardo-Alves20-ores.vps-ores.service
             ├─57847 /bin/bash /opt/actions-runner/runsvc.sh
             └─57856 ./externals/node20/bin/node ./bin/RunnerService.js

Apr 30 16:32:39 sistemaores.vps-kinghost.net systemd[1]: Started actions.runner.Eduardo-Alves20-ores.vps-ores.ser…ores).
Hint: Some lines were ellipsized, use -l to show in full.
root@sistemaores:/opt/actions-runner#