FROM php:8.4-fpm-alpine

# curl-dev = ext-curl (requerido por Laravel 13, no viene en la imagen base).
# libpng-dev/libjpeg-turbo-dev/freetype-dev = ext-gd, que phpoffice/phpspreadsheet
# 5.9 exige en composer.lock (aunque acá solo se lee .xlsx/.ods, no se dibuja
# nada) — sin esto el build de producción falla en el paso de composer install.
RUN apk add --no-cache \
        curl-dev \
        postgresql-dev \
        oniguruma-dev \
        libxml2-dev \
        libpng-dev \
        libjpeg-turbo-dev \
        freetype-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install \
        curl \
        dom \
        pdo \
        pdo_pgsql \
        mbstring \
        xml \
        pcntl \
        gd \
    && printf "upload_max_filesize=250M\npost_max_size=260M\nmemory_limit=256M\nmax_execution_time=300\n" > /usr/local/etc/php/conf.d/rsa.ini \
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

CMD ["sh", "-c", "php artisan migrate --force && php artisan db:seed --class=AdminSeeder --force && php artisan db:seed --class=HazardTypeSeeder --force && php artisan serve --host=0.0.0.0 --port=${PORT:-10000}"]
