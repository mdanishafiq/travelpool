import { Component, OnInit } from '@angular/core';
import {SolidProfile} from '../../../models/solid-profile.model';
import {RdfService} from '../../../services/rdf.service';
import {FormControl, FormGroup} from '@angular/forms';
import {Router} from '@angular/router';
import { PrivateStorageService } from 'src/app/services/private-storage/private-storage.service';
import { QueueService } from 'src/app/services/queue/queue.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-following-list',
  templateUrl: './following-list.component.html',
  styleUrls: ['./following-list.component.css']
})
export class FollowingListComponent implements OnInit {
  private USERTIMELINE:string = '/usertimeline';
  authFollowingIds: string[];
  sugestedList: SolidProfile[];
  followingList: SolidProfile[] = [];
  authUser: SolidProfile;
  isBad = false;
  findForm = new FormGroup({
    webId: new FormControl()
  });
  q: string;
  public isAbbleToSendRequest: {[key:string]: boolean}= {};

  constructor(
    private rdfService: RdfService, 
    private router: Router,
    private queue:QueueService,
    private privateStorage:PrivateStorageService,
    private toastr: ToastrService
  ) { }

  async ngOnInit() {
    await this.getFollowers();
    await this.suggFriends();
  }

  async getFollowers(isForce:boolean = false) {
    const followingList:SolidProfile[] = [];
    this.authUser = await this.rdfService.getProfile();
    this.authFollowingIds = await this.rdfService.getFriendsOf(this.authUser.webId, isForce);
    

    for (let i = 0; i < this.authFollowingIds.length; i++) {
      const profile:SolidProfile =  await this.rdfService.collectProfileData(this.authFollowingIds[i]);
      if (profile) {
        followingList.push(profile);
        // If request is returning 403 status code then user have created private file and not granted access to current authorized user  
        this.privateStorage.isUserGrantedMeAccess(profile.webId).then((status: number) => {
          this.isAbbleToSendRequest[profile.webId] = status == 403;
        });
      }
    }
    this.followingList = followingList;
  }

  async suggFriends(limit = 5) {
    this.sugestedList = [];
    // get friends of friends that are not my friends
    for (let i = 0; i < this.authFollowingIds.length; i++) {
      const fof = await this.rdfService.getFriendsOf(this.authFollowingIds[i]);
      for (let j = 0; j < fof.length; j++) {
        if (
            this.authFollowingIds.indexOf(fof[j]) === -1 &&
            fof[j] !== this.authUser.webId &&
            !this.sugestedList.find(r => r.webId === fof[j])
        ) {
          const profile: SolidProfile = await this.rdfService.collectProfileData(fof[j]);
          
          if (profile) {
            this.sugestedList.push(profile);
          }
        }
        if (limit === this.sugestedList.length) { break; }
      }
      if (limit === this.sugestedList.length) { break; }
    }
  }

  async findFriend() {
    this.q = this.findForm.getRawValue().webId;
    try {
      const prof = await this.rdfService.collectProfileData(this.q);
      this.isBad = false;
      this.router.navigateByUrl(this.USERTIMELINE + '?webId=' + encodeURIComponent(this.q));
    } catch (e) {
      this.isBad = true;
    }
  }

  async followUser(user:SolidProfile): Promise<void> {
    await this.rdfService.updateFollowingList([user.webId], []);
    await this.getFollowers(true);
  }
  
  async unFollowUser(user:SolidProfile): Promise<void> {
    await this.rdfService.updateFollowingList([], [user.webId]);
    await this.getFollowers(true);
  }

  async sendRequest(user:SolidProfile): Promise<void> {
    if (!this.authUser) return;

    let r: boolean = await this.queue.sendRequestAddInFriends(
      user.webId, 
      this.authUser.webId
    );

    if (!r) {
      this.toastr.error(`Sorry, but ${user.fn} does not use our application. Please inform him about that opportunity.`, 'Can not send a request');
    } else {
      this.toastr.success(`${user.fn} will receive your request to grant you an access to the private reviews`, 'Request is sended');
    }
  }
}
