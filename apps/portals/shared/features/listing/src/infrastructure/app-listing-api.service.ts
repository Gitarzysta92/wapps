import { Injectable } from "@angular/core";
import { delay, Observable, of } from "rxjs";
import { Result } from "@foundation/standard";
import { IAppListingProvider } from "../application";
import { AppListingQueryDto } from "../application/models/app-listing-query.dto";
import { AppListingSliceDto } from "../application/models/record-listing.dto";

@Injectable()
export class AppListingApiService implements IAppListingProvider {
  private readonly _appsAndIcons = [
    { name: 'Photo Snap', logo: 'https://static.store.app/cdn-cgi/image/width=1080,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/b97294dce1f25dd2d6ad681ed223f25e-512x512.png' },
    { name: 'Quick Task', logo: 'https://static.store.app/cdn-cgi/image/width=256,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png' },
    { name: 'Speedy VPN', logo: 'https://static.store.app/cdn-cgi/image/width=256,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/d7e5e0edf74303ccd0859d4d88036938-1024x1024.png' },
    { name: 'Budget Buddy', logo: 'https://static.store.app/cdn-cgi/image/width=256,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/562263fe6e7c9f9b0d0ff6b4eeae6bd6-506x497.png' },
    { name: 'Mindful', logo: 'https://static.store.app/cdn-cgi/image/width=256,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/562263fe6e7c9f9b0d0ff6b4eeae6bd6-506x497.png' },
    { name: 'FitTrack', logo: 'https://static.store.app/cdn-cgi/image/width=256,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/562263fe6e7c9f9b0d0ff6b4eeae6bd6-506x497.png' },
    { name: 'ShopEase', logo: 'https://static.store.app/cdn-cgi/image/width=256,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png' },
    { name: 'Travel Mate', logo: 'https://static.store.app/cdn-cgi/image/width=256,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/562263fe6e7c9f9b0d0ff6b4eeae6bd6-506x497.png' },
    { name: 'MusicBox', logo: 'https://static.store.app/cdn-cgi/image/width=256,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/1377b172723c9700810b9bc3d21fd0ff-400x400.png' },
    { name: 'Study Flow', logo: 'https://static.store.app/cdn-cgi/image/width=256,quality=75,format=auto/https://store-app-images.s3.us-east-1.amazonaws.com/562263fe6e7c9f9b0d0ff6b4eeae6bd6-506x497.png' },
  ];

  private readonly _tagIds = [1, 2, 3, 4, 5]; // Simulate categories like Productivity, Music, Health, etc.
  private readonly _platformIds = [1, 2, 3]; // 1 - iOS, 2 - Android, 3 - Web/PWA

  prefetchAppListing(r: AppListingQueryDto): void {
    console.log('prefetch');
  }

  public getAppListing(p: AppListingQueryDto): Observable<Result<AppListingSliceDto, Error>> {
    const { batchSize = 10, index = 0 } = p;

    const items = Array.from({ length: batchSize }, (_, i) =>
      this._generateRandomItem(i + index * batchSize + 1)
    );

    const randomNetworkDelay = 300 + Math.random() * 1200;

    const result: Result<AppListingSliceDto, Error> = {
      ok: true,
      value: {
        items,
        hash: this._createQuickFixedHash(p.query),
        count: items.length,
        index: index,
        maxCount: 5 * batchSize
      }
    };
    return of(result).pipe(delay(randomNetworkDelay));
  }

  private _generateRandomItem(id: number): AppListingSliceDto['items'][number] {
    const randomApp = this._randomPick(this._appsAndIcons);
    const randomRating = +(Math.random() * 5).toFixed(1);
    const randomReviews = +(Math.random() * 20).toFixed(0);
    const randomTags = this._randomSample(this._tagIds, 2); // Pick 2 random tags
    const randomPlatforms = this._randomSample(this._platformIds, 2); // Pick 2 random platforms

    return {
      id,
      slug: randomApp.name.toLowerCase().replace(/\s+/g, '-'),
      name: randomApp.name,
      logo: randomApp.logo,
      isPwa: Math.random() > 0.5,
      rating: randomRating,
      reviews: randomReviews,
      tagIds: randomTags,
      categoryId: this._randomPick(this._tagIds),
      platformIds: randomPlatforms,
    };
  }

  private _randomPick<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private _randomSample<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private _createQuickFixedHash(query: { [key: string]: string[] }): string {
    const str = JSON.stringify(query);
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }

    return Math.abs(hash).toString(16);
  }
}
