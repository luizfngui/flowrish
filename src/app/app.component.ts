// src/app/app.component.ts

import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type CursorState = 'default' | 'link' | 'drag';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
})
export class AppComponent implements AfterViewInit {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('hero', { static: false }) hero?: ElementRef<HTMLElement>;
  @ViewChild('nav', { static: false }) nav?: ElementRef<HTMLElement>;
  @ViewChild('heroLeft', { static: false }) heroLeft?: ElementRef<HTMLElement>;
  @ViewChild('heroRight', { static: false }) heroRight?: ElementRef<HTMLElement>;
  @ViewChild('cursor', { static: false }) cursor?: ElementRef<HTMLElement>;
  @ViewChild('cursorDot', { static: false }) cursorDot?: ElementRef<HTMLElement>;
  @ViewChild('paper', { static: false }) paper?: ElementRef<HTMLElement>;

  // Services refs for parallax
  @ViewChild('servicesSection', { static: false })
  servicesSection?: ElementRef<HTMLElement>;
  @ViewChild('servicesBgA', { static: false })
  servicesBgA?: ElementRef<HTMLElement>;
  @ViewChild('servicesBgB', { static: false })
  servicesBgB?: ElementRef<HTMLElement>;

  // Custom cursor state
  private mouseX = 0;
  private mouseY = 0;
  private dotX = 0;
  private dotY = 0;
  private rafId: number | null = null;

  // Motion preference
  reduceMotion = false;

  // SERVICES state (default selected = 0)
  activeServiceIndex = 0;
  readonly serviceBgs = [
    'images/image1.jpg',
    'images/image2.jpg',
    'images/image3.jpg',
  ];

  currentServiceBg = this.serviceBgs[0];
  nextServiceBg = this.serviceBgs[0];
  isServicesFading = false;
  private fadeTimer: number | null = null;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    // Enable initial hidden reveal CSS only when we intend to run GSAP.
    // Failsafe: if GSAP doesn't init, remove the class so content shows.
    if (!this.reduceMotion) {
      document.documentElement.classList.add('gsap-on');

      window.setTimeout(() => {
        if (
          document.documentElement.classList.contains('gsap-on') &&
          !(window as any).__GSAP_READY__
        ) {
          document.documentElement.classList.remove('gsap-on');
        }
      }, 1500);
    }

    const finePointer = window.matchMedia?.('(pointer: fine)')?.matches ?? false;
    if (finePointer) this.startCursorLoop();

    if (!this.reduceMotion) {
      this.initGsap();
    }
  }

  // Services: hover/select behavior + background crossfade
  setActiveService(index: number) {
  if (index === this.activeServiceIndex) return;

  this.activeServiceIndex = index;
  const url = this.serviceBgs[index];

  // If an animation is in progress, commit immediately before starting a new one
  if (this.fadeTimer) {
    window.clearTimeout(this.fadeTimer);
    this.fadeTimer = null;
    this.currentServiceBg = this.nextServiceBg;
    this.isServicesFading = false;
  }

  // Stage next image on layer B, then crossfade
  this.nextServiceBg = url;

  // Trigger crossfade (CSS animates A -> 0, B -> 1)
  this.isServicesFading = true;

  // After fade completes, commit & reset
  this.fadeTimer = window.setTimeout(() => {
    this.currentServiceBg = this.nextServiceBg;
    this.isServicesFading = false;
    this.fadeTimer = null;
  }, 700); // must match CSS transition duration
}

  private startCursorLoop() {
    const loop = () => {
      this.dotX += (this.mouseX - this.dotX) * 0.18;
      this.dotY += (this.mouseY - this.dotY) * 0.18;

      const c = this.cursor?.nativeElement;
      const d = this.cursorDot?.nativeElement;

      if (c)
        c.style.transform = `translate3d(${this.dotX}px, ${this.dotY}px, 0)`;
      if (d)
        d.style.transform = `translate3d(${this.mouseX}px, ${this.mouseY}px, 0)`;

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  }

  setCursorState(state: CursorState) {
    const c = this.cursor?.nativeElement;
    const d = this.cursorDot?.nativeElement;
    if (!c || !d) return;

    c.dataset['state'] = state;
    d.dataset['state'] = state;
  }

  scrollTo(id: string) {
    if (!this.isBrowser) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({
      behavior: this.reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  private async initGsap() {
    try {
      const gsapModule = await import('gsap');
      const stModule = await import('gsap/ScrollTrigger');

      const gsap = gsapModule.gsap;
      const ScrollTrigger = stModule.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);

      (window as any).__GSAP_READY__ = true;

      const hero = this.hero?.nativeElement;
      const left = this.heroLeft?.nativeElement;
      const right = this.heroRight?.nativeElement;
      const nav = this.nav?.nativeElement;
      const paper = this.paper?.nativeElement;

      if (!hero || !left || !right || !paper) {
        document.documentElement.classList.remove('gsap-on');
        return;
      }

      // Nav reveal
      if (nav) {
        gsap.fromTo(
          nav,
          { y: -12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }
        );
      }

      // Helper: move element's center to viewport center
      const centerDeltaX = (el: HTMLElement) => () => {
        const r = el.getBoundingClientRect();
        const elCenter = r.left + r.width / 2;
        const vpCenter = window.innerWidth / 2;
        return vpCenter - elCenter;
      };

      gsap.set([left, right], { willChange: 'transform, opacity, filter' });
      gsap.set(paper, { yPercent: 100, willChange: 'transform' });

      const pinOpts = {
        pin: true,
        pinType: 'fixed' as const,
        pinReparent: true,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      };

      // Phase 1: pinned hero
      const heroPinTl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: () => `+=${Math.round(window.innerHeight * 1.35)}`,
          scrub: 1.5,
          ...pinOpts,
        },
      });

      heroPinTl
        .addLabel('join', 0)
        .addLabel('fade', 0.78)
        .to(left, { x: centerDeltaX(left), duration: 0.78 }, 'join')
        .to(right, { x: centerDeltaX(right), duration: 0.78 }, 'join')
        .to(
          [left, right],
          { y: -8, scale: 0.985, opacity: 0.95, duration: 0.78 },
          'join'
        )
        .to(
          [left, right],
          { y: -40, opacity: 0, filter: 'blur(10px)', duration: 0.22 },
          'fade'
        );

      // Phase 2: paper overlays
      gsap.to(paper, {
        yPercent: 0,
        ease: 'power2.inOut',
        scrollTrigger: {
          trigger: hero,
          start: 'top top+=20%',
          end: () => `+=${Math.round(window.innerHeight * 1.4)}`,
          scrub: 1.6,
          invalidateOnRefresh: true,
        },
      });

      // Services background parallax (both layers)
      const services = this.servicesSection?.nativeElement;
      const bgA = this.servicesBgA?.nativeElement;
      const bgB = this.servicesBgB?.nativeElement;

      if (services && bgA && bgB) {
        gsap.set([bgA, bgB], { willChange: 'transform' });

        gsap.to([bgA, bgB], {
          yPercent: -10,
          ease: 'none',
          scrollTrigger: {
            trigger: services,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1.2,
            invalidateOnRefresh: true,
          },
        });
      }

      // Reveal animations (robust + matches CSS)
      const revealEls = Array.from(
        document.querySelectorAll('[data-reveal]')
      ) as HTMLElement[];

      revealEls.forEach((el) => {
        const mode = el.dataset['reveal'] || 'up';

        // Initial hidden state via GSAP (matches css html.gsap-on)
        if (mode === 'left') {
          gsap.set(el, { opacity: 0, filter: 'blur(10px)', x: -64, y: 10 });
        } else if (mode === 'right') {
          gsap.set(el, { opacity: 0, filter: 'blur(10px)', x: 64, y: 10 });
        } else {
          gsap.set(el, { opacity: 0, filter: 'blur(10px)', x: 0, y: 22 });
        }

        gsap.set(el, { willChange: 'transform, opacity, filter' });

        gsap.to(el, {
          opacity: 1,
          filter: 'blur(0px)',
          x: 0,
          y: 0,
          duration: 0.9,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 82%',
            toggleActions: 'play none none reverse',
            invalidateOnRefresh: true,
          },
        });
      });

      ScrollTrigger.refresh(true);
      requestAnimationFrame(() => ScrollTrigger.refresh(true));
    } catch (err) {
      console.error('GSAP init failed:', err);
      document.documentElement.classList.remove('gsap-on');
    }
  }
}
