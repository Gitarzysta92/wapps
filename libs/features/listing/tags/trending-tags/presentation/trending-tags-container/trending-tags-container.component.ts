import { Component, inject, Output } from '@angular/core';
import { TRENDING_TAGS_PROVIDER } from '../../application/ports';
import { map, Subject } from 'rxjs';
import { AsyncPipe } from '@angular/common';
import { TagDtoToTagViewModelMapper } from '../mappings/trending-tag-dto-to-trending-tag-view-model.mapper';
import { TuiChip } from '@taiga-ui/kit';
import { TrendingTagVm } from '../models';

@Component({
  selector: 'trending-tags-container',
  templateUrl: './trending-tags-container.component.html',
  styleUrl: './trending-tags-container.component.scss',
  imports: [
    AsyncPipe,
    TuiChip
  ]
})
export class TrendingTagsContainerComponent {

  @Output() selectedTag: Subject<TrendingTagVm> = new Subject();

  private readonly _service = inject(TRENDING_TAGS_PROVIDER);
  private readonly _mapper = inject(TagDtoToTagViewModelMapper);

  public readonly trendingTags$ = this._service.getTrendingTags()
    .pipe(map(r => r.value.map(t => this._mapper.map(t)) ?? []))
  
  
}
