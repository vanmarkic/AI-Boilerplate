import { Routes } from "@angular/router";
import { WaitingRoomView } from "./waiting-room-view";
import { practiceRedirectGuard } from "./practice-redirect.guard";

export const WAITING_ROOM_ROUTES: Routes = [
  {
    path: "",
    component: WaitingRoomView,
    canActivate: [practiceRedirectGuard],
  },
];
