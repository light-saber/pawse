# Pawse — tiny static site served by nginx
FROM nginx:alpine
COPY index.html style.css script.js pixeldog.js /usr/share/nginx/html/
COPY fonts/ /usr/share/nginx/html/fonts/
EXPOSE 80
# Healthcheck so your VPS/orchestrator knows it's up
HEALTHCHECK CMD wget -q --spider http://localhost/ || exit 1
