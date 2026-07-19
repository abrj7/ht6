// Real TTC subway stations and Toronto POIs with lat/lng for walk-time enrichment.
// Used by the RAG corpus to ground "near subway / near CN Tower" queries.

export const TTC_STATIONS = [
  { id: "union", name: "Union Station", line: "Yonge-University", lat: 43.6453, lng: -79.3806 },
  { id: "king", name: "King Station", line: "Yonge-University", lat: 43.6488, lng: -79.3784 },
  { id: "queen", name: "Queen Station", line: "Yonge-University", lat: 43.6525, lng: -79.3792 },
  { id: "dundas", name: "Dundas Station", line: "Yonge-University", lat: 43.6563, lng: -79.3807 },
  { id: "college", name: "College Station", line: "Yonge-University", lat: 43.6617, lng: -79.3832 },
  { id: "wellesley", name: "Wellesley Station", line: "Yonge-University", lat: 43.6655, lng: -79.3839 },
  { id: "bloor-yonge", name: "Bloor-Yonge Station", line: "Yonge-University", lat: 43.6702, lng: -79.3856 },
  { id: "rosedale", name: "Rosedale Station", line: "Yonge-University", lat: 43.6769, lng: -79.3929 },
  { id: "st-andrew", name: "St Andrew Station", line: "Yonge-University", lat: 43.6476, lng: -79.3817 },
  { id: "osgoode", name: "Osgoode Station", line: "Yonge-University", lat: 43.6508, lng: -79.3865 },
  { id: "st-patrick", name: "St Patrick Station", line: "Yonge-University", lat: 43.6539, lng: -79.3892 },
  { id: "queens-park", name: "Queen's Park Station", line: "Yonge-University", lat: 43.6598, lng: -79.3903 },
  { id: "museum", name: "Museum Station", line: "Yonge-University", lat: 43.6677, lng: -79.3942 },
  { id: "bay", name: "Bay Station", line: "Yonge-University", lat: 43.6543, lng: -79.3806 },
  { id: "spadina", name: "Spadina Station", line: "Yonge-University", lat: 43.6672, lng: -79.4034 },
  { id: "st-george", name: "St George Station", line: "Yonge-University", lat: 43.6683, lng: -79.3997 },
  { id: "bathurst", name: "Bathurst Station", line: "Bloor-Danforth", lat: 43.6412, lng: -79.4063 },
  { id: "christie", name: "Christie Station", line: "Bloor-Danforth", lat: 43.6656, lng: -79.4189 },
  { id: "ossington", name: "Ossington Station", line: "Bloor-Danforth", lat: 43.6499, lng: -79.4249 },
  { id: "dufferin", name: "Dufferin Station", line: "Bloor-Danforth", lat: 43.6375, lng: -79.4351 },
  { id: "broadview", name: "Broadview Station", line: "Bloor-Danforth", lat: 43.6768, lng: -79.3578 },
  { id: "sherbourne", name: "Sherbourne Station", line: "Bloor-Danforth", lat: 43.6727, lng: -79.3756 },
  { id: "castle-frank", name: "Castle Frank Station", line: "Bloor-Danforth", lat: 43.6736, lng: -79.3688 },
];

export const TORONTO_POIS = [
  { id: "cn-tower", name: "CN Tower", lat: 43.6426, lng: -79.3871 },
  { id: "bahen", name: "Bahen Centre (U of T)", lat: 43.6598, lng: -79.3965 },
  { id: "tiff", name: "TIFF Bell Lightbox", lat: 43.6465, lng: -79.3893 },
  { id: "st-lawrence", name: "St Lawrence Market", lat: 43.6487, lng: -79.3715 },
  { id: "distillery", name: "Distillery District", lat: 43.6503, lng: -79.3596 },
  { id: "rogers-centre", name: "Rogers Centre", lat: 43.6414, lng: -79.389 },
  { id: "eaton-centre", name: "Toronto Eaton Centre", lat: 43.6544, lng: -79.3806 },
  { id: "harbourfront", name: "Harbourfront Centre", lat: 43.6389, lng: -79.3822 },
  { id: "kensington", name: "Kensington Market", lat: 43.6545, lng: -79.4003 },
  { id: "yorkville", name: "Yorkville", lat: 43.6709, lng: -79.3925 },
  { id: "royal-ontario", name: "Royal Ontario Museum", lat: 43.6677, lng: -79.3948 },
  { id: "high-park", name: "High Park", lat: 43.6465, lng: -79.4637 },
];

/** Alias strings from NL queries -> POI id */
export const POI_ALIASES = {
  "cn tower": "cn-tower",
  cn: "cn-tower",
  bahen: "bahen",
  "bahen centre": "bahen",
  uoft: "bahen",
  tiff: "tiff",
  "st lawrence": "st-lawrence",
  "st lawrence market": "st-lawrence",
  distillery: "distillery",
  "distillery district": "distillery",
  harbourfront: "harbourfront",
  kensington: "kensington",
  "kensington market": "kensington",
  yorkville: "yorkville",
  rom: "royal-ontario",
  museum: "royal-ontario",
};

export function findPoi(alias) {
  const id = POI_ALIASES[alias.toLowerCase()];
  if (!id) return null;
  return TORONTO_POIS.find((p) => p.id === id) ?? null;
}
