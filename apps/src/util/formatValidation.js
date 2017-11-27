// RFC 5322 Official Standard email regex
// Source: http://emailregex.com/

const EMAIL_REGEX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
export const isEmail = (value) => EMAIL_REGEX.test(value);

const ZIP_CODE_REGEX = /^\d{5}([\W-]?\d{4})?$/;
export const isZipCode = (value) => ZIP_CODE_REGEX.test(value);

export const isInt = (value) => {
  // Sub out commas
  let newValue = value.replace(/,/g, "");
  /* eslint-disable eqeqeq*/
  return parseInt(newValue, 10) == newValue;
  /* eslint-enable eqeqeq*/
};
export const isPercent = (value) => {
  let percent = parseFloat(value, 10);

  return 0 <= percent && percent <= 100;
};
