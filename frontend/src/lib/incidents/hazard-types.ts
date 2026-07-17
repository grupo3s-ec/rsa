import {
  Signpost, CircleDot, Ticket, CornerUpRight, CornerDownRight, Mountain,
  Footprints, Fuel, PersonStanding, Waypoints, ChevronsDown, School, Gauge,
  RotateCw, CloudFog, EyeOff, Skull, UsersRound, Flame, ShieldOff, HelpCircle,
  type LucideIcon,
} from 'lucide-react';
import type { HazardType } from '@/types/incident';

/**
 * Catálogo de tipos de peligro — espejo estático de la tabla `hazard_types`
 * en producción (20 filas, fijas, cambian solo si se re-clasifica el
 * catálogo a mano). Evita depender de `GET /api/hazard-types` para poblar
 * el diálogo de reporte: en el Render free tier, el primer request tras un
 * cold-start puede tardar decenas de segundos, dejando el diálogo colgado
 * en "Cargando catálogo…".
 *
 * Los `id` deben coincidir exactamente con los de la base de datos (son la
 * foreign key `hazard_type_id` que se envía al crear un incidente) — si el
 * catálogo real cambia (nuevo tipo, id distinto), hay que actualizar esto.
 */
export const HAZARD_TYPES: HazardType[] = [
  { id: 1,  condition: 'fisica',                  name: 'Intersección',                     risks: 'Choque, accidente de tránsito', severity: 'high' },
  { id: 2,  condition: 'fisica',                  name: 'Semáforo',                         risks: 'Atropellamiento, choque', severity: 'high' },
  { id: 3,  condition: 'fisica',                  name: 'Peaje',                            risks: 'N/A', severity: 'low' },
  { id: 4,  condition: 'fisica',                  name: 'Curva peligrosa',                  risks: 'Volcamiento', severity: 'medium' },
  { id: 5,  condition: 'fisica',                  name: 'Curva',                            risks: 'Salir de vía, invasión de carril, encunetar', severity: 'medium' },
  { id: 6,  condition: 'fisica',                  name: 'Caída de rocas',                   risks: 'Aplastamiento, deslizamiento, derrape', severity: 'high' },
  { id: 7,  condition: 'fisica',                  name: 'Pasos peatonales',                 risks: 'Atropellamiento', severity: 'low' },
  { id: 8,  condition: 'fisica',                  name: 'Estación de servicios',            risks: 'N/A', severity: 'low' },
  { id: 9,  condition: 'fisica',                  name: 'Puente peatonal',                  risks: 'Peatones imprudentes, no usan paso peatonal, atropellamiento', severity: 'medium' },
  { id: 10, condition: 'fisica',                  name: 'Cruce peligroso',                  risks: 'Choque, accidente de tránsito', severity: 'high' },
  { id: 11, condition: 'fisica',                  name: 'Descenso',                         risks: 'Recalentamiento de frenos', severity: 'medium' },
  { id: 12, condition: 'fisica',                  name: 'Zona escolar',                     risks: 'Atropellamiento', severity: 'high' },
  { id: 13, condition: 'fisica',                  name: 'Límite de velocidad',              risks: 'Choque, accidente de tránsito', severity: 'high' },
  { id: 14, condition: 'fisica',                  name: 'Glorieta',                         risks: 'Choque, accidente de tránsito', severity: 'high' },
  { id: 15, condition: 'natural',                 name: 'Neblina',                          risks: 'Choque, accidente de tránsito', severity: 'medium' },
  { id: 16, condition: 'natural',                 name: 'Poca visibilidad',                 risks: 'Choque, accidente de tránsito', severity: 'medium' },
  { id: 17, condition: 'entorno_riesgo_publico',  name: 'Piratería',                        risks: 'Robo, hurto, atraco', severity: 'high' },
  { id: 18, condition: 'entorno_riesgo_publico',  name: 'Polizones',                        risks: 'Caídas del vehículo, accidentados, fatalidades', severity: 'high' },
  { id: 19, condition: 'entorno_riesgo_publico',  name: 'Paros, huelgas, manifestaciones',  risks: 'Incendio del vehículo y mercancía, robo, hurto', severity: 'medium' },
  { id: 20, condition: 'entorno_riesgo_publico',  name: 'Guerrilla en la zona',              risks: 'Incendio del vehículo y mercancía, robo, hurto', severity: 'medium' },
];

/** Ícono distinto por tipo de condición — antes se reusaba el mismo ícono
 * de la condición (Física/Natural/Entorno) para los 20 tipos, lo que se veía
 * genérico (14 botones idénticos bajo "Física"). Clave = `name` exacto de
 * `HAZARD_TYPES`. */
const HAZARD_TYPE_ICONS: Record<string, LucideIcon> = {
  'Intersección':                     Signpost,
  'Semáforo':                         CircleDot,
  'Peaje':                            Ticket,
  'Curva peligrosa':                  CornerUpRight,
  'Curva':                            CornerDownRight,
  'Caída de rocas':                   Mountain,
  'Pasos peatonales':                 Footprints,
  'Estación de servicios':            Fuel,
  'Puente peatonal':                  PersonStanding,
  'Cruce peligroso':                  Waypoints,
  'Descenso':                         ChevronsDown,
  'Zona escolar':                     School,
  'Límite de velocidad':              Gauge,
  'Glorieta':                         RotateCw,
  'Neblina':                          CloudFog,
  'Poca visibilidad':                 EyeOff,
  'Piratería':                        Skull,
  'Polizones':                        UsersRound,
  'Paros, huelgas, manifestaciones':  Flame,
  'Guerrilla en la zona':             ShieldOff,
};

export function getHazardTypeIcon(name: string): LucideIcon {
  return HAZARD_TYPE_ICONS[name] ?? HelpCircle;
}
