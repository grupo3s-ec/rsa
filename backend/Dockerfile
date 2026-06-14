FROM php:8.3-fpm-alpine

# curl-dev = ext-curl (requerido por Laravel 13, no viene en la imagen base)
RUN apk add --no-cache \
        curl-dev \
        postgresql-dev \
        oniguruma-dev \
        libxml2-dev \
    && docker-php-ext-install \
        curl \
        dom \
        pdo \
        pdo_pgsql \
        mbstring \
        xml \
        pcntl \
    && curl -sS https://getcomposer.org/installer \
       | php -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN COMPOSER_MEMORY_LIMIT=-1 composer install \
    --no-dev --no-scripts --no-autoloader --prefer-dist

COPY . .
RUN COMPOSER_MEMORY_LIMIT=-1 composer install \
    --no-dev --optimize-autoloader \
    && chmod -R 775 storage bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 10000

CMD ["sh", "-c", "php artisan serve --host=0.0.0.0 --port=${PORT:-10000}"]
