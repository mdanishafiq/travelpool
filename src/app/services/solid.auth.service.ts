import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from } from 'rxjs';
import { RdfService } from './rdf.service';
import { SolidProvider } from '../models/solid-provider.model';
import { ISolidRoot } from '../models/solid-api'; 
import { SolidProfile } from '../models/solid-profile.model';
import { ReviewService } from './review.service';

declare let solid: ISolidRoot;

interface SolidSession {
  accessToken: string;
  clientId: string;
  idToken: string;
  sessionKey: string;
  webId: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  session: Observable<SolidSession>;
  fechInit = {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/sparql-update',
    },
    body: '',
  };

  constructor(
    private router: Router,
    private rdf: RdfService,
    private reviewService: ReviewService
  ) {
    this.isSessionActive();
  }

  /*
   * This will check if current session is active to avoid security problems
  */
  isSessionActive = async () => {
    this.session = from(solid.auth.currentSession());
  }

  /**
   * Alternative login-popup function. This will open a popup that will allow you to choose an identity provider
   * without leaving the current page
   * This is recommended if you don't want to leave the current workflow.
   */
  solidLoginPopup = async (redirectPath: string): Promise<void> => {
    try {
      await solid.auth.popupLogin({ popupUri: './login-popup'});
      // Check if session is valid to avoid redirect issues
      await this.isSessionActive();

      // popupLogin success redirect to destination page
      this.router.navigate([redirectPath]);
    } catch (error) {
      console.log(`Error: ${error}`);
    }
  }

  /*
  * Signs out of Solid in this app, by calling the logout function and clearing the localStorage token
  */
  solidSignOut = async () => {
    this.reviewService.clean();
    try {
      await solid.auth.logout();
      // Remove localStorage
      localStorage.removeItem('solid-auth-client');
      localStorage.removeItem('oldProfileData');
      // Redirect to login page
      this.router.navigate(['/']);
    } catch (error) {
      console.log(`Error: ${error}`);
    }
  }
  
  saveOldUserData(profile: SolidProfile): void {
    if (!localStorage.getItem('oldProfileData')) {
      localStorage.setItem('oldProfileData', JSON.stringify(profile));
    }
  }

  getOldUserData(): SolidProfile {
    return JSON.parse(localStorage.getItem('oldProfileData'));
  }

  /*
  *  Make a call to the solid auth endpoint. It requires an identity provider url, which here is coming from the dropdown, which
  *  is populated by the getIdentityProviders() function call. It currently requires a callback url and a storage option or else
  *  the call will fail.
  */
  async solidLogin(idp: string, redirectUrl: string): Promise<void> {
    // Attention: callbackUri must include target domain!
    await solid.auth.login(idp, {
      // Example: callbackUri: `${window.location.origin}/reviews`,
      callbackUri: redirectUrl,
      storage: localStorage,
    });
  }

  /**
   * Function to get providers. This is to mimic the future provider registry
   *
   * @return {SolidProvider[]} A list of SolidProviders
   */
  getIdentityProviders(): SolidProvider[] {
    const inruptProvider: SolidProvider = {
      name: 'Inrupt',
      image: '/assets/images/Inrupt.png',
      loginUrl: 'https://inrupt.net/auth',
      desc: 'Inrupt Inc. provider'
    };
    const solidCommunityProvider: SolidProvider = {
      name: 'Solid Community',
      image: '/assets/images/Solid.png',
      loginUrl: 'https://solid.community',
      desc: 'A provider maintained by the Solid Community'
    };
    const otherProvider: SolidProvider = {
      name: 'Other (Enter WebID)',
      image: '/assets/images/Generic.png',
      loginUrl: null,
      desc: 'Generic provider'
    };

    return [
      inruptProvider,
      solidCommunityProvider,
      otherProvider
    ];
  }
}
