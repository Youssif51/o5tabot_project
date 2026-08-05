const fs = require('fs');
const path = require('path');

const bostaData = require('./محافظات/المناطق التابعه لكل محافظة.json');
const qalyubia = bostaData.data.find(c => c.cityOtherName.includes('قليوب') || c.cityName.toLowerCase().includes('qalyub'));
console.log("Qalyubia city details:", qalyubia ? {
  cityId: qalyubia.cityId,
  cityName: qalyubia.cityName,
  cityOtherName: qalyubia.cityOtherName,
  cityCode: qalyubia.cityCode
} : "Not found");
