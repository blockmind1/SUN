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
} from 'lit-element';

import {
  HomeAssistant,
  LovelaceCardEditor,
} from 'custom-card-helpers';

import moment from 'moment';
import 'moment-timezone';
import { HumanizeDurationLanguage, HumanizeDuration } from 'humanize-duration-ts';

import { HassEntity } from 'home-assistant-js-websocket';

import {
  SunCardConfig,
  Coords,
  TimeEntity,
  SunEntity,
  createSunEntity,
  MoonEntity,
} from './types';

import './editor';

const SVG_ICONS = {
  sunrise: 'M3,12H7C7,9.24 9.24,7 12,7C14.76,7 17,9.24 17,12H21C21.55,12 22,12.45 22,13C22,13.55 21.55,' +
    '14 21,14H3C2.45,14 2,13.55 2,13C2,12.45 2.45,12 3,12M15,12C15,10.34 13.66,9 12,9C10.34,9 9,10.34 9,12' +
    'H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,' +
    '7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,' +
    '8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M12.71,16.3L15.82,19.41C16.21,19.8 16.21,20.43 15.82,20.82' +
    'C15.43,21.21 14.8,21.21 14.41,20.82L12,18.41L9.59,20.82C9.2,21.21 8.57,21.21 8.18,20.82C7.79,20.43 7.79,' +
    '19.8 8.18,19.41L11.29,16.3C11.5,16.1 11.74,16 12,16C12.26,16 12.5,16.1 12.71,16.3Z',
  noon: 'M12,7C14.76,7 17,9.24 17,12C17,14.76 14.76,17 12,17C9.24,17 7,14.76 7,12C7,9.24 9.24,7 12,7M12,9' +
    'C10.34,9 9,10.34 9,12C9,13.66 10.34,15 12,15C13.66,15 15,13.66 15,12C15,10.34 13.66,9 12,9M12,2L14.39,5.42' +
    'C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,' +
    '9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,' +
    '17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,' +
    '17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56' +
    'C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z',
  sunset: 'M3,12H7C7,9.24 9.24,7 12,7C14.76,7 17,9.24 17,12H21C21.55,12 22,12.45 22,13C22,13.55 21.55,14 21,14' +
    'H3C2.45,14 2,13.55 2,13C2,12.45 2.45,12 3,12M15,12C15,10.34 13.66,9 12,9C10.34,9 9,10.34 9,12H15M12,2L14.39,' +
    '5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5' +
    'C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,' +
    '7.15 16.5,6.64L20.65,7M12.71,20.71L15.82,17.6C16.21,17.21 16.21,16.57 15.82,16.18C15.43,15.79 14.8,' +
    '15.79 14.41,16.18L12,18.59L9.59,16.18C9.2,15.79 8.57,15.79 8.18,16.18C7.79,16.57 7.79,17.21 8.18,17.6' +
    'L11.29,20.71C11.5,20.9 11.74,21 12,21C12.26,21 12.5,20.9 12.71,20.71Z',
  daylight: 'M12,7C14.76,7 17,9.24 17,12C17,14.76 14.76,17 12,17C9.24,17 7,14.76 7,12C7,9.24 9.24,7 12,7M12,9' +
    'C10.34,9 9,10.34 9,12C9,13.66 10.34,15 12,15C13.66,15 15,13.66 15,12C15,10.34 13.66,9 12,9M12,2L14.39,5.42' +
    'C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,' +
    '9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,' +
    '17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,' +
    '17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56' +
    'C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z',
};

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

  readonly svgViewBoxW: number = 24 * 60; // 24h * 60 minutes - viewBox width in local points

  readonly svgViewBoxH: number = 432; // viewBox height in local points

  // half of svg viewBox height / (| -zenith | + zenith elevation angle)
  readonly yScale: number = this.svgViewBoxH / 180;

  readonly humanizer: HumanizeDuration = new HumanizeDuration(new HumanizeDurationLanguage());

  public setConfig(config: SunCardConfig): void {
    if (!config || !config.type) {
      throw new Error('Invalid configuration');
    }

    this._config = config;
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

  public getCardSize(): number {
    return 6;
  }

  protected render(): TemplateResult | void {
    if (!this._config || !this.hass) {
      return html``;
    }

    const timeFormat: string =
      this._config.meridiem === undefined && 'LT' ||
      this._config.meridiem === true && 'h:mm A' ||
      'H:mm';
    const { localize, states } = this.hass;

    const sunStateObj: HassEntity = states['sun.sun'];
    const moonStateObj: HassEntity = states['sensor.moon'];
    const timeStateObj: HassEntity = states['sensor.time_utc'];

    if (!sunStateObj || !timeStateObj) {
      return html`
        <hui-warning>
          ${localize('ui.panel.lovelace.warning.entity_not_found', 'entity', 'sun.sun, sensor.time_utc')}
        </hui-warning>
      `;
    }

    const currentTimeEntity: TimeEntity = new TimeEntity(timeStateObj);
    const sunEntity: SunEntity = createSunEntity(states, currentTimeEntity);
    const moonEntity: MoonEntity | null = moonStateObj ? new MoonEntity(moonStateObj) : null;

    const renderSun = (): SVGTemplateResult => {
      const sunPos: Coords = this.metric(currentTimeEntity.time, sunEntity.elevation);
      return svg`
        <line class="sun" x1="${sunPos.x}" x2="${sunPos.x}" y1="${sunPos.y}" y2="${sunPos.y}" />
      `;
    };
    const renderSunbeam = (): SVGTemplateResult => {
      const sunPos: Coords = this.metric(currentTimeEntity.time, sunEntity.elevation);
      return svg`
        <line class="sunbeam" x1="${sunPos.x}" x2="${sunPos.x}" y1="${sunPos.y}" y2="${sunPos.y}" />
      `;
    };

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
        <ha-icon icon=${moonEntity.icon}></ha-icon>
      `;
    };

    const header = this._config.name === undefined
      ? sunEntity.friendly_name || localize('domain.sun')
      : this._config.name;

    return html`
      <ha-card .header=${header || null}>
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
