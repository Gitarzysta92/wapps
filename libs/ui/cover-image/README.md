# Cover Image

A simple Angular component for displaying cover images with configurable size and object-fit properties.

## Usage

```typescript
import { CoverImageComponent, type CoverImageDto } from '@ui/cover-image';

@Component({
  imports: [CoverImageComponent]
})
export class MyComponent {
  coverImage: CoverImageDto = {
    imageUrl: 'https://example.com/image.jpg',
    alt: 'Alternative text for the image',
    height: '300px',
    objectFit: 'cover'
  };
}
```

```html
<ui-cover-image [image]="coverImage"></ui-cover-image>
```

## API

### Input

- `image` (CoverImageDto, optional): Cover image configuration object

### CoverImageDto

```typescript
interface CoverImageDto {
  imageUrl?: string;           // URL of the image
  alt?: string;                 // Alternative text (defaults to 'Cover image')
  height?: string;              // Height of container (defaults to '200px')
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'; // Defaults to 'cover'
}
```

