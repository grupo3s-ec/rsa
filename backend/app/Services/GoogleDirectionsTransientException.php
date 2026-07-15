<?php

namespace App\Services;

/** Señala un fallo transitorio (cuota agotada, rechazo de la API, red/timeout)
 * al llamar a la Directions API — a diferencia de "no hay ruta entre estos dos
 * puntos" (que es un null normal, ej. ubicaciones sin conexión vial conocida),
 * esto significa que reintentar más tarde probablemente sí funcione, así que
 * el llamador no debe marcar la fila como sin ruta permanentemente. */
class GoogleDirectionsTransientException extends \RuntimeException
{
}
