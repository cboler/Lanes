import { Routes } from '@angular/router';
import { BattlefieldComponent } from './battle/battlefield.component';
import { SquadSelectComponent } from './squad/squad-select.component';
import { StatusComponent } from './status/status.component';

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
    path: '**',
    redirectTo: '',
  },
];
