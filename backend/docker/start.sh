#!/bin/sh
set -e

# `php artisan serve` (el server de desarrollo integrado de PHP) no aguanta
# uploads grandes/lentos de forma confiable — moría a medio subir el .xlsx
# de la ANT con "Invalid request (Unexpected EOF)", sin llegar siquiera a
# que Laravel lo procese. nginx + PHP-FPM (para lo que está pensada esta
# imagen *-fpm-alpine) es el servidor real.
# Config completa propia (no solo un server block en http.d/) — `user root;`
# va adentro del archivo, así que no hace falta (ni puede, sin chocar como
# directiva duplicada) pasarlo también por `-g`.
sed "s/\${PORT}/${PORT:-10000}/g" /var/www/html/docker/nginx.conf.template > /etc/nginx/nginx.conf
# `set -e` corta acá con un error legible si la config quedó mal armada, en
# vez de que nginx falle más adelante de forma menos clara.
nginx -t

php artisan migrate --force
php artisan db:seed --class=AdminSeeder --force
php artisan db:seed --class=HazardTypeSeeder --force

php-fpm -t
php-fpm -D
exec nginx -g "daemon off;"
