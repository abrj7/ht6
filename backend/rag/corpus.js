import { TTC_STATIONS, TORONTO_POIS } from "../data/torontoTransit.js";
import { nearestPoint } from "./geo.js";
import { cheapestTotal } from "./bookUrl.js";

const HOME_CITY = "Toronto, ON";
const SUBWAY_WALK_MAX = 12;
const POI_WALK_MAX = 15;

export function enrichTransit(property, city) {
  if (city !== HOME_CITY || !property.location?.lat) return null;

  const origin = { lat: property.location.lat, lng: property.location.lng };
  const station = nearestPoint(origin, TTC_STATIONS);
  if (!station) return null;

  return {
    name: station.name,
    type: "subway",
    line: station.line,
    walkMinutes: station.walkMinutes,
  };
}

export function enrichPoiDistance(property, poi) {
  if (!poi || !property.location?.lat) return null;
  const origin = { lat: property.location.lat, lng: property.location.lng };
  const minutes = nearestPoint(origin, [poi]).walkMinutes;
  return { name: poi.name, type: "poi", walkMinutes: minutes };
}

export function buildCorpusDoc(property, city) {
  const price = cheapestTotal(property);
  const amenities = (property.amenities ?? []).join(", ");
  const nearest = enrichTransit(property, city);
  const stationLine = nearest
    ? `Nearest TTC station: ${nearest.name} (${nearest.line}), ${nearest.walkMinutes} minute walk.`
    : "";

  const text = [
    property.name,
    `Type: ${property.type}`,
    `City: ${city}`,
    property.location?.address ? `Address: ${property.location.address}` : "",
    price != null ? `Price: $${price} CAD per night` : "",
    property.rating != null ? `Guest rating: ${property.rating} out of 10` : "",
    property.capacity != null ? `Sleeps ${property.capacity} guests` : "",
    property.policies?.freeCancellation ? "Free cancellation available" : "No free cancellation",
    property.policies?.instantBook ? "Instant book" : "",
    amenities ? `Amenities: ${amenities}` : "",
    stationLine,
    nearest && nearest.walkMinutes <= SUBWAY_WALK_MAX ? "Near subway transit" : "",
  ]
    .filter(Boolean)
    .join(". ");

  return {
    id: property.id,
    property,
    city,
    text,
    price,
    nearestStation: nearest,
    amenities: property.amenities ?? [],
  };
}

export function buildCorpus(properties) {
  return properties.map(({ property, city }) => buildCorpusDoc(property, city));
}

export { SUBWAY_WALK_MAX, POI_WALK_MAX, HOME_CITY };
