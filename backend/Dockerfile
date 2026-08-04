FROM php:8.4-fpm-alpine

# curl-dev = ext-curl (requerido por Laravel 13, no viene en la imagen base).
# libpng-dev/libjpeg-turbo-dev/freetype-dev = ext-gd; libzip-dev = ext-zip —
# ambas las exige phpoffice/phpspreadsheet 5.9 en composer.lock (aunque acá
# solo se lee .xlsx/.ods) y ninguna de las dos viene en la imagen base, igual
# que dom/xml. simplexml/xmlreader/xmlwriter dependen de libxml igual que
# dom/xml y por el mismo motivo tampoco vienen — se instalan explícitas para
# no repetir este ciclo de build fallido extensión por extensión.
# max_execution_time=600 (antes 300): el upload de la BDD ANT (.xlsx, ~10K
# filas leídas en chunks — ver AntSiniestrosImporter) mide varios minutos
# reales por el 0.1 CPU del free tier de Render; empareja con el timeout del
# lado del cliente (10 min, ver uploadAntSiniestros en el frontend).
RUN apk add --no-cache \
        curl-dev \
        postgresql-dev \
        oniguruma-dev \
        libxml2-dev \
        libpng-dev \
        libjpeg-turbo-dev \
        freetype-dev \
        libzip-dev \
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
        zip \
        simplexml \
        xmlreader \
        xmlwriter \
    && printf "upload_max_filesize=250M\npost_max_size=260M\nmemory_limit=256M\nmax_execution_time=600\n" > /usr/local/etc/php/conf.d/rsa.ini \
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
