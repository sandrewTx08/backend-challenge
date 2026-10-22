export interface Clock {
  now(): Date;
}

export interface ClockPort extends Clock {}
