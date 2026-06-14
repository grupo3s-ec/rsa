FROM php:8.3-fpm-alpine

# Dependencias del sistema + extensiones PHP requeridas por Laravel + Postgres
RUN apk add --no-cache \
        nginx \
        supervisor \
        postgresql-dev \
        libpng-dev \
        oniguruma-dev \
        libxml2-dev \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        opcache \
        mbstring \
        xml \
        pcntl \
    && curl -sS https://getcomposer.org/installer \
        | php -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /var/www/html

# Instala dependencias de Composer primero (layer cacheable)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

# Copia el código y finaliza la instalación
COPY . .
RUN composer install --no-dev --optimize-autoloader \
    && php artisan config:clear \
    && chmod -R 775 storage bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

# Config de nginx y supervisor
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 10000

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
