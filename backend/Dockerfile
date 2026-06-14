FROM php:8.3-fpm-alpine

# Solo lo necesario para Laravel API + PostgreSQL
RUN apk add --no-cache \
        postgresql-dev \
        oniguruma-dev \
        libxml2-dev \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        mbstring \
        xml \
        pcntl \
    && curl -sS https://getcomposer.org/installer \
       | php -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /var/www/html

# Capa de dependencias cacheable
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

# Código fuente
COPY . .
RUN composer install --no-dev --optimize-autoloader \
    && chmod -R 775 storage bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 10000

# php artisan serve es suficiente para free tier / demo
CMD ["sh", "-c", "php artisan serve --host=0.0.0.0 --port=${PORT:-10000}"]
