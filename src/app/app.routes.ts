import { Routes } from '@angular/router';
import { BattlefieldComponent } from './battle/battlefield.component';
import { SquadSelectComponent } from './squad/squad-select.component';
import { StatusComponent } from './status/status.component';
import { DefenseSetupComponent } from './defense/defense-setup.component';

export const routes: Routes = [
  {
    path: '',
    component: BattlefieldComponent,
    title: 'Tactical Battlefield • Lanes',
  },
  {
    path: 'squad',
    component: SquadSelectComponent,
    title: 'Squad Builder • Lanes',
  },
  {
    path: 'status',
    component: StatusComponent,
    title: 'Diagnostics • Lanes',
  },
  {
    path: 'defense',
    component: DefenseSetupComponent,
    title: 'Defense Orders • Lanes',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
