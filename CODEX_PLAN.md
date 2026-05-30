root@BOT:~/ores# docker-compose down --remove-orphans || true
Stopping ores_ores_1 ... done
Removing ores_ores_1               ... done
Removing befeba3f8d75_ores_mongo_1 ... done
Removing network ores_default
root@BOT:~/ores# docker rm -f befeba3f8d75_ores_mongo_1 2>/dev/null || true
root@BOT:~/ores# docker rm -f befeba3f8d75_ores_mongo_1 2>/dev/null || true
root@BOT:~/ores# apt-get update
Hit:1 http://mirrors.digitalocean.com/ubuntu jammy InRelease
Get:2 http://mirrors.digitalocean.com/ubuntu jammy-updates InRelease [128 kB]
Hit:3 http://mirrors.digitalocean.com/ubuntu jammy-backports InRelease
Hit:4 https://repos-droplet.digitalocean.com/apt/droplet-agent main InRelease
Hit:5 https://repos.insights.digitalocean.com/apt/do-agent main InRelease
Get:6 http://security.ubuntu.com/ubuntu jammy-security InRelease [129 kB]
Get:7 http://mirrors.digitalocean.com/ubuntu jammy-updates/main amd64 Packages [3435 kB]
Get:8 http://mirrors.digitalocean.com/ubuntu jammy-updates/main amd64 c-n-f Metadata [19.6 kB]
Get:9 http://mirrors.digitalocean.com/ubuntu jammy-updates/universe amd64 Packages [1268 kB]
Get:10 http://mirrors.digitalocean.com/ubuntu jammy-updates/universe amd64 c-n-f Metadata [30.5 kB]
Get:11 http://security.ubuntu.com/ubuntu jammy-security/main amd64 Packages [3171 kB]
Get:12 http://security.ubuntu.com/ubuntu jammy-security/main amd64 c-n-f Metadata [14.2 kB]
Fetched 8195 kB in 9s (890 kB/s)
Reading package lists... Done
root@BOT:~/ores# apt-get install -y docker-compose-plugin
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
E: Unable to locate package docker-compose-plugin
root@BOT:~/ores# docker compose up -d --build --remove-orphans
unknown shorthand flag: 'd' in -d

Usage:  docker [OPTIONS] COMMAND [ARG...]

Run 'docker --help' for more information
root@BOT:~/ores#
