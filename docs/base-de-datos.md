# Base de datos — del demo a Supabase (Postgres)

## Fase 1 (demo, actual)

El demo corre sobre **SQLite** sin configuración (`DB_CONNECTION=sqlite`). El archivo
vive en `backend/database/database.sqlite`. Para preparar datos:

```bash
cd backend
php artisan migrate:fresh --seed
```

Esto crea la tabla `incidents` y siembra incidentes de ejemplo en la zona de Quito.

## Fase 1 en la nube — Supabase (Postgres, plan gratis)

El esquema ya es **compatible con Postgres** (tipos `decimal`, índices estándar);
las migraciones no requieren cambios. Para migrar:

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan free).
2. En **Settings → Database**, copia las credenciales de conexión.
3. En `backend/.env`, cambia el bloque de base de datos:

   ```env
   DB_CONNECTION=pgsql
   DB_HOST=db.<project-ref>.supabase.co
   DB_PORT=5432
   DB_DATABASE=postgres
   DB_USERNAME=postgres
   DB_PASSWORD=<tu-password>
   DB_SSLMODE=require
   ```

   Para entornos serverless/edge, usa el **pooler** (puerto `6543`):

   ```env
   DB_HOST=aws-0-<region>.pooler.supabase.com
   DB_PORT=6543
   ```

4. Ejecuta las migraciones contra Supabase:

   ```bash
   php artisan migrate --seed
   ```

`config/database.php` ya respeta `DB_SSLMODE` (`env('DB_SSLMODE', 'prefer')`), por lo
que la conexión TLS a Supabase funciona sin cambios de código.

## Futuro — precisión geoespacial (PostGIS)

Hoy el filtro de incidentes por ruta usa un *bounding box* aproximado
(`RouteIncidentController`). Con Postgres/Supabase se puede habilitar **PostGIS** y
migrar a `ST_DWithin` sobre una columna `geography(Point)` para precisión real por
distancia a la ruta. Supabase incluye la extensión PostGIS (`create extension postgis;`).
