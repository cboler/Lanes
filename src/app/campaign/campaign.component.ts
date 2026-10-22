import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CAMPAIGN } from '../core/models/campaign-story';
import { getClassDefinition } from '../core/models/unit-class.model';
import { CampaignService } from '../core/services/campaign.service';

/** The journal records the journey; story scenes and encounters take place on the map. */
@Component({
  selector: 'app-campaign',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './campaign.component.html',
  styleUrl: './campaign.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignComponent {
  protected readonly campaign = inject(CampaignService);
  protected readonly chapters = CAMPAIGN;
  protected readonly total = CAMPAIGN.reduce((sum, chapter) => sum + chapter.missions.length, 0);
  protected classPortrait(classId: string): string {
    return getClassDefinition(classId).portraitUrl;
  }
  protected className(classId: string): string {
    return getClassDefinition(classId).name;
  }
}
