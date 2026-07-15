<?php

namespace App\Services;

/** Señala un fallo transitorio (cuota agotada, rechazo de la API, red/timeout)
 * al llamar a la Geocoding API — a diferencia de "no hay resultado para este
 * lugar" (que es un null normal), esto significa que reintentar más tarde
 * probablemente sí funcione, así que el llamador no debe marcar la fila como
 * 'fallido' permanentemente. */
class GoogleGeocodingTransientException extends \RuntimeException
{
}
