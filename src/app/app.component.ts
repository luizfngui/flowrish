// src/app/app.component.ts

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

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
  readonly serviceBgs = ['images/image1.jpg', 'images/image2.jpg', 'images/image3.jpg'];

  currentServiceBg = this.serviceBgs[0];
  nextServiceBg = this.serviceBgs[0];
  isServicesFading = false;

  private fadeTimer: number | null = null;

  // Smoother hover switching
  private pendingServiceIndex: number | null = null;
  private hoverRaf: number | null = null;
  private lastSwitchAt = 0;

  // Must match CSS vars in styles.css
  private readonly FADE_MS = 950; // smoother, slightly longer
  private readonly MIN_GAP_MS = 130; // small buffer to prevent thrash

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    // Safety: never keep content hidden by old gsap-on patterns
    document.documentElement.classList.remove('gsap-on');

    this.reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

    // Preload service backgrounds to remove decode stutter
    this.preloadServiceImages();

    const finePointer = window.matchMedia?.('(pointer: fine)')?.matches ?? false;
    if (finePointer) {
      this.zone.runOutsideAngular(() => this.startCursorLoop());
    }

    if (!this.reduceMotion) {
      this.zone.runOutsideAngular(() => {
        requestAnimationFrame(() => {
          this.initGsap();
        });
      });
    }
  }

  ngOnDestroy(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.fadeTimer) window.clearTimeout(this.fadeTimer);
    if (this.hoverRaf) cancelAnimationFrame(this.hoverRaf);
  }

  // Services pointer handlers (your HTML calls these)
  onServiceEnter(index: number) {
    this.setCursorState('link');
    this.queueActiveService(index);
  }

  onServiceLeave() {
    this.setCursorState('default');
  }

  private queueActiveService(index: number) {
    const now = performance.now();
    this.pendingServiceIndex = index;

    if (this.hoverRaf) return;

    this.hoverRaf = requestAnimationFrame(() => {
      this.hoverRaf = null;

      const since = now - this.lastSwitchAt;
      if (since < this.MIN_GAP_MS) {
        window.setTimeout(() => {
          if (this.pendingServiceIndex != null) {
            const idx = this.pendingServiceIndex;
            this.pendingServiceIndex = null;
            this.zone.run(() => this.setActiveService(idx));
          }
        }, this.MIN_GAP_MS - since);
        return;
      }

      const idx = this.pendingServiceIndex;
      this.pendingServiceIndex = null;
      this.zone.run(() => this.setActiveService(idx!));
    });
  }

  // Services: hover/select behavior + background crossfade (smoother)
  setActiveService(index: number) {
    if (index === this.activeServiceIndex) return;

    this.activeServiceIndex = index;
    const url = this.serviceBgs[index];
    this.lastSwitchAt = performance.now();

    // If a fade is already in progress, commit current state first
    if (this.fadeTimer) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
      this.currentServiceBg = this.nextServiceBg;
      this.isServicesFading = false;
    }

    // Stage next image on layer B, then crossfade
    this.nextServiceBg = url;

    // Trigger crossfade (CSS animates opacity + subtle zoom)
    this.isServicesFading = true;
    this.cdr.markForCheck();

    // After fade completes, commit & reset
    this.fadeTimer = window.setTimeout(() => {
      this.zone.run(() => {
        this.currentServiceBg = this.nextServiceBg;
        this.isServicesFading = false;
        this.fadeTimer = null;
        this.cdr.markForCheck();
      });
    }, this.FADE_MS);
  }

  private preloadServiceImages() {
    // Pre-decode images to avoid lag on the first hover
    for (const src of this.serviceBgs) {
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = src;
      // If supported, hint decode early (no-op on some browsers)
      (img as any).decode?.().catch?.(() => {});
    }
  }

  private startCursorLoop() {
    const loop = () => {
      this.dotX += (this.mouseX - this.dotX) * 0.18;
      this.dotY += (this.mouseY - this.dotY) * 0.18;

      const c = this.cursor?.nativeElement;
      const d = this.cursorDot?.nativeElement;

      if (c) c.style.transform = `translate3d(${this.dotX}px, ${this.dotY}px, 0)`;
      if (d) d.style.transform = `translate3d(${this.mouseX}px, ${this.mouseY}px, 0)`;

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

      const hero = this.hero?.nativeElement;
      const left = this.heroLeft?.nativeElement;
      const right = this.heroRight?.nativeElement;
      const nav = this.nav?.nativeElement;
      const paper = this.paper?.nativeElement;

      if (!hero || !left || !right || !paper) return;

      // Nav reveal
      if (nav) {
        gsap.fromTo(
          nav,
          { y: -12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out', immediateRender: false }
        );
      }

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

      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: () => `+=${Math.round(window.innerHeight * 1.35)}`,
          scrub: 1.5,
          ...pinOpts,
        },
      })
        .addLabel('join', 0)
        .addLabel('fade', 0.78)
        .to(left, { x: centerDeltaX(left), duration: 0.78 }, 'join')
        .to(right, { x: centerDeltaX(right), duration: 0.78 }, 'join')
        .to([left, right], { y: -8, scale: 0.985, opacity: 0.95, duration: 0.78 }, 'join')
        .to([left, right], { y: -40, opacity: 0, filter: 'blur(10px)', duration: 0.22 }, 'fade');

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

      // ✅ Better parallax: almost static (tiny drift)
      const services = this.servicesSection?.nativeElement;
      const bgA = this.servicesBgA?.nativeElement;
      const bgB = this.servicesBgB?.nativeElement;

      if (services && bgA && bgB) {
        gsap.set([bgA, bgB], { willChange: 'transform' });

        // very subtle drift so it feels “anchored”
        gsap.to([bgA, bgB], {
          yPercent: -3.5,
          ease: 'none',
          scrollTrigger: {
            trigger: services,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1.1,
            invalidateOnRefresh: true,
          },
        });
      }

      // Reveal animations
      const revealEls = Array.from(document.querySelectorAll('[data-reveal]')) as HTMLElement[];

      revealEls.forEach((el) => {
        const mode = el.dataset['reveal'] || 'up';
        const from =
          mode === 'left'
            ? { opacity: 0, filter: 'blur(10px)', x: -64, y: 10 }
            : mode === 'right'
            ? { opacity: 0, filter: 'blur(10px)', x: 64, y: 10 }
            : { opacity: 0, filter: 'blur(10px)', x: 0, y: 22 };

        gsap.set(el, { willChange: 'transform, opacity, filter' });

        gsap.fromTo(
          el,
          from,
          {
            opacity: 1,
            filter: 'blur(0px)',
            x: 0,
            y: 0,
            duration: 0.9,
            ease: 'power2.out',
            immediateRender: false,
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
              invalidateOnRefresh: true,
            },
          }
        );
      });

      const refreshAll = () => {
        ScrollTrigger.refresh(true);
        ScrollTrigger.update();
      };

      requestAnimationFrame(refreshAll);
      setTimeout(refreshAll, 300);
      (document as any).fonts?.ready?.then?.(() => refreshAll());
      window.addEventListener('load', refreshAll, { once: true });
    } catch (err) {
      console.error('GSAP init failed:', err);
    }
  }
}
