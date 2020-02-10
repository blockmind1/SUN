import {
  LitElement,
  html,
  svg,
  customElement,
  property,
  CSSResult,
  TemplateResult,
  SVGTemplateResult,
  css,
  PropertyValues,
} from 'lit-element';

import {
  HomeAssistant,
  LovelaceCardEditor,
} from 'custom-card-helpers';

import moment from 'moment';
import 'moment/min/locales';
import 'moment-timezone/builds/moment-timezone-with-data';

import { HumanizeDurationLanguage, HumanizeDuration } from 'humanize-duration-ts';

import { CARD_VERSION, SVG_ICONS } from './const';

import {
  SunCardConfig,
  Coords,
  ISun,
  IMoon,
  ITime,
  EntityMutator,
} from './types';

import './editor';
import { Factory } from './entities';
import defaultConfig from './config';

/* eslint no-console: 0 */
console.info(`%c SUN-CARD %c ${CARD_VERSION} `,
  'color: white; background: coral; font-weight: 700;',
  'color: coral; background: white; font-weight: 700;');

let updateFunc: EntityMutator|undefined;

@customElement('sun-card')
class SunCard extends LitElement {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('sun-card-editor') as LovelaceCardEditor;
  }

  public static getStubConfig(): object {
    return {};
  }

  @property() private _hass?: HomeAssistant;

  @property() private _config?: SunCardConfig;

  private _provider?: ISun & IMoon & ITime;

  readonly svgViewBoxW: number = 24 * 60; // 24h * 60 minutes - viewBox width in local points

  readonly svgViewBoxH: number = 432; // viewBox height in local points

  // half of svg viewBox height / (| -zenith | + zenith elevation angle)
  readonly yScale: number = this.svgViewBoxH / 180;

  readonly humanizer: HumanizeDuration = new HumanizeDuration(new HumanizeDurationLanguage());

  public setConfig(newConfig: SunCardConfig): void {
    if (!newConfig || !newConfig.type) {
      throw new Error('Invalid configuration');
    }
    this._config = newConfig;
  }

  get config(): SunCardConfig {
    const entitiesConfig = {
      ...defaultConfig.entities,
      ...this._config ? this._config.entities : null,
    };
    return {
      ...defaultConfig,
      ...this._config,
      entities: entitiesConfig,
    };
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    if (hass) {
      moment.locale(hass.language);
      moment.tz.setDefault(hass.config.time_zone);
      this.humanizer.setOptions({
        language: hass.language,
        delimiter: ' ',
        units: ['h', 'm'],
        round: true,
      });
    }
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.has('_config')) {
      return true;
    }

    const oldHass = changedProps.get('_hass') as HomeAssistant | undefined;
    return oldHass
      ? Object.values(this.config!.entities).some((entityName) => {
        return oldHass.states[entityName] !== this.hass!.states[entityName];
      })
      : false;
  }

  protected update(changedProps: PropertyValues) {
    if (changedProps.has('_config')) {
      [this._provider, updateFunc] = Factory.create(this.hass!.states, this.config);
    }
    const oldHass = changedProps.get('_hass') as HomeAssistant | undefined;
    if (oldHass) {
      Object.values(this.config!.entities).forEach((entityName) => {
        if (oldHass.states[entityName] !== this.hass!.states[entityName]) updateFunc!(this.hass!.states[entityName]);
      });
    }

    super.update(changedProps);
  }

  public getCardSize(): number {
    return 6;
  }

  protected render(): TemplateResult | void {
    if (!this._config || !this.hass || !this._provider) {
      return html``;
    }

    const currentTimeEntity: ITime = this._provider;
    const sunEntity: ISun = this._provider;
    const moonEntity: IMoon = this._provider;

    const renderSun = (): SVGTemplateResult => {
      const sunPos: Coords = this.metric(currentTimeEntity.current_time, sunEntity.elevation);
      return svg`
        <line class="sun" x1="${sunPos.x}" x2="${sunPos.x}" y1="${sunPos.y}" y2="${sunPos.y}" />
      `;
    };
    const renderSunbeam = (): SVGTemplateResult => {
      const sunPos: Coords = this.metric(currentTimeEntity.current_time, sunEntity.elevation);
      return svg`
        <line class="sunbeam" x1="${sunPos.x}" x2="${sunPos.x}" y1="${sunPos.y}" y2="${sunPos.y}" />
      `;
    };

    const timeFormat =
      this._config!.meridiem === undefined && 'LT' ||
      this._config!.meridiem === true && 'h:mm A' ||
      'H:mm';
    const sunrise: [string, moment.Moment] = [SVG_ICONS.sunrise, sunEntity.sunrise];
    const noon: [string, moment.Moment] = [SVG_ICONS.noon, sunEntity.solar_noon];
    const sunset: [string, moment.Moment] = [SVG_ICONS.sunset, sunEntity.sunset];
    const [renderSunrise,
           renderNoon,
           renderSunset] = [sunrise, noon, sunset].map(([svgData, event], index): Function => {
      return () => {
        if (!event.isValid()) {
          return svg``;
        }
        const inverter: number = 1 - 2 * (index % 2); // returns [1, -1, 1, -1, ...]
        const eventPos: Coords = this.metric(event, 0);
        return svg`
          <line class="event-line" x1="${eventPos.x}" y1="0" x2="${eventPos.x}" y2="${-100 * inverter}"/>
          <g transform="translate(${eventPos.x - 100},${-125 * inverter - 25})">
            <svg viewBox="0 0 150 25" preserveAspectRatio="xMinYMin slice" width="300" height="50">
              <path d="${svgData}"></path>
              <text class="event-time" dominant-baseline="middle" x="25" y="12.5">
                ${event.format(timeFormat)}
              </text>
            </svg>
          </g>
        `;
      };
    });

    const renderTimeToSunset = (): TemplateResult => {
      if (!sunEntity.to_sunset.isValid()) {
        return html``;
      }
      return html`
        <div>
          <ha-icon slot="item-icon" icon="mdi:weather-sunset-down"></ha-icon>
          <span class="item-text">: ${sunEntity.to_sunset.humanize(true)}</span>
        </div>
      `;
    };

    const renderDaylight = (): TemplateResult => {
      if (!sunEntity.daylight.isValid()) {
        return html``;
      }
      return html`
        <div>
          <ha-icon slot="item-icon" icon="mdi:weather-sunny"></ha-icon>
          <span class="item-text">: ${this.humanizer.humanize(sunEntity.daylight.asMilliseconds())}</span>
        </div>
      `;
    };

    const renderMoon = (): TemplateResult => {
      if (!moonEntity) {
        return html``;
      }
      return html`
        <ha-icon icon=${moonEntity.moon_icon}></ha-icon>
      `;
    };

    const header = this._config.name
      || this.hass.states['sun.sun'].attributes.friendly_name
      || this.hass.localize('domain.sun');
    return html`
      <ha-card .header=${header}>
        <div class="content">
          <svg class="top" preserveAspectRatio="xMinYMin slice" viewBox="0 -${this.svgViewBoxH / 2} ${this.svgViewBoxW} ${this.svgViewBoxH / 2}" xmlns="http://www.w3.org/2000/svg" version="1.1">
            ${renderSunrise()}
            ${renderSunset()}
            ${renderSunbeam()}
            ${renderSun()}
          </svg>
          <svg class="bottom" preserveAspectRatio="xMinYMax slice" viewBox="0 0 ${this.svgViewBoxW} ${this.svgViewBoxH / 2}" xmlns="http://www.w3.org/2000/svg" version="1.1">
            <line x1="0" y1="0" x2="${this.svgViewBoxW}" y2="0" class="horizon" />
            ${renderNoon()}
            ${renderSun()}
          </svg>
          <div class="moon-icon">
            ${renderMoon()}
          </div>
        </div>
        <div class="info">
          ${renderTimeToSunset()}
          ${renderDaylight()}
        </div>
      </ha-card>
    `;
  }

  private metric(time: moment.Moment, elevation: number): Coords {
    return {
      x: time.hour() * 60 + time.minute(),
      y: -elevation * this.yScale,
    };
  }

  static get styles(): CSSResult {
    return css`
      .warning {
        display: block;
        color: black;
        background-color: #fce588;
        padding: 8px;
      }
      .content {
        background: var(--sc-background, linear-gradient(rgba(242, 249, 254,  0%),
                                                          rgb(214, 240, 253) 46%,
                                                          rgb(182, 224,  38) 54%,
                                                         rgba(171, 220,  40,  0%)));
        display: flex;
        flex-flow: column nowrap;
        position: relative;
      }
      .moon-icon {
        position: absolute;
        right: 5px;
        opacity: 0.5;
      }
      svg {
        width: 100%;
        position: relative;
        stroke-width: 4;
        fill: var(--primary-text-color);
        vector-effect: non-scaling-stroke;
      }
      svg .horizon {
        stroke: var(--sc-horizon-color, transparent);
      }
      svg .event-time {
        font-size: 22px;
      }
      svg .event-line {
        stroke: var(--sc-event-line-color, #212121);
      }
      svg .sun {
        stroke: var(--sc-sun-color, #ffe160);
        stroke-width: var(--sc-sun-size, 60px);
        stroke-linecap: round;
      }
      @keyframes beam {
        from { opacity: 1; stroke-width: var(--sc-sun-size, 60px); }
        to   { opacity: 0; stroke-width: calc(2 * var(--sc-sun-size, 60px)); }
      }
      svg .sunbeam {
        stroke: var(--sc-sunbeam-color, #fbec5d);
        stroke-width: var(--sc-sun-size, 60px);
        stroke-linecap: round;
        opacity: 1;
        will-change: opacity, stroke-width;
        animation: beam 3s linear infinite;
      }
      svg.bottom .sun {
        stroke-width: var(--sc-sun-size, 60px);
        stroke: var(--sc-sun-night-color, #b3e5fc);
      }
      .info {
        display: flex;
        flex-flow: row nowrap;
        padding: 16px;
      }
      .info > div:not(:last-child) {
        margin-right: 30px;
      }
      .info span {
        vertical-align: middle;
      }
    `;
  }
}
