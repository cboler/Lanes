import { Routes } from '@angular/router';
import { GuildComponent } from './guild/guild.component';

// The Guild Hall is the home screen; every other page loads when first visited.
export const routes: Routes = [
  {
    path: '',
    component: GuildComponent,
    title: 'Guild Hall • Lanes',
  },
  {
    path: 'battle',
    loadComponent: () =>
      import('./battle/battlefield.component').then((m) => m.BattlefieldComponent),
    title: 'Tactical Battlefield • Lanes',
  },
  {
    path: 'campaign',
    loadComponent: () => import('./campaign/campaign.component').then((m) => m.CampaignComponent),
    title: 'Campaign • Lanes',
  },
  {
    path: 'squad',
    loadComponent: () =>
      import('./squad/squad-select.component').then((m) => m.SquadSelectComponent),
    title: 'Squad Builder • Lanes',
  },
  {
    path: 'roster',
    loadComponent: () => import('./roster/roster.component').then((m) => m.RosterComponent),
    title: 'Mercenary Roster • Lanes',
  },
  {
    path: 'status',
    loadComponent: () => import('./status/status.component').then((m) => m.StatusComponent),
    title: 'Diagnostics • Lanes',
  },
  {
    path: 'defense',
    loadComponent: () =>
      import('./defense/defense-setup.component').then((m) => m.DefenseSetupComponent),
    title: 'Defense Orders • Lanes',
  },
  {
    path: 'options',
    loadComponent: () => import('./options/options.component').then((m) => m.OptionsComponent),
    title: 'Options • Lanes',
  },
  // The guild hall was /guild before it became the home screen.
  { path: 'guild', redirectTo: '' },
  {
    path: '**',
    redirectTo: '',
  },
];
