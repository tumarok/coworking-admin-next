import { Badge } from '@/components/ui/badge';
import type { Amenity } from '@/lib/contract/room';
import { humanize } from '@/lib/humanize';

/** The amenities of a room as badges; a dash when it has none. */
export function AmenityBadges({ amenities }: { amenities: readonly Amenity[] }) {
  if (amenities.length === 0) return <>—</>;
  return (
    <ul aria-label="Amenities" className="flex flex-wrap gap-1">
      {amenities.map((amenity) => (
        <li key={amenity}>
          <Badge variant="secondary">{humanize(amenity)}</Badge>
        </li>
      ))}
    </ul>
  );
}
