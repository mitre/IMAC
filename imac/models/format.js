/*
 * format.js
 *      format identification and conversion utility functions
 */
 

/* SET UP FORMAT INTERFACES */
this.format_map = {};
this.test_map = {};
this.conversion_map = {};

require('./format_imac').init(this);
require('./format_jsonArrays').init(this);
require('./format_jsonObjects').init(this);

/*
 * CONVERSION FUNCTION FOR IMPORT
 */
this.convert = function(input, errFunc = null, fromFormat = null, toFormat = "IMAC") {
   input=input.replace(/^\r?\n*/g,"");
   // determine input format if not passed explicitly
   if (fromFormat === null) {
       var fmats = this.getFormats(input, errFunc);
       if (fmats === null || fmats.length !== 1) {
          if (errFunc !== null)
            errFunc("convert: ambiguous or unknown format");
       }
   }
   if (fromFormat !== null) {
      // if input format is valid...
      if (typeof(this.conversion_map[this.format_map[fromFormat]]) !== 'undefined' &&
            typeof(this.conversion_map[this.format_map[fromFormat]][this.format_map[toFormat]]) !== 'undefined') {
         // and we know how to convert from fromFormat to toFormat
         // then return the result
         return this.conversion_map[this.format_map[fromFormat]][this.format_map[toFormat]](input, errFunc);
      } else {
         // and we DON'T know how to convert from fromFormat to toFormat
         // then return null after calling errFunc
         if (errFunc !== null)
            errFunc("Conversion from: "+fromFormat+" to: "+toFormat+" is not defined");
         return null;
      }
   }

   // input format issue -- errFunc before returning null
   if (errFunc !== null)
      errFunc("fromFormat was invalid or input format could not be determined.");
   return null;
};

/*
 * VALIDITY AND IDENTIFICATION
 */

// valid input passes one of the format tests
this.isValid = function(input, errFunc = null) {
   input=input.replace(/^\r?\n*/g,"");
   var fmats = this.getFormats(input, errFunc);
   return fmats !== null;
};

// returns the format_map value that the input has been characterized as having
this.getFormatValues = function(input, errFunc = null) {
   var fmats = this.getFormats(input, errFunc);
   if (fmats === null) return null;
   return fmats.map(function(f) { 
      return this.format_map[f];
   });
};

// returns the format_map key that the input has been characterized as having
this.getFormats = function(input, errFunc = null) {
   input=input.replace(/^\r?\n*/g,"");
   console.log("input="+input);
   var errs = [];
   var formats = [];
   // helper to create a function that has the format name in its error string
   var internalErrFunc = function(format) {
      return function(error) {
         var strerror = ""+format+": "+error;
         errs = errs.concat(strerror);
      };
   };
   // find first format with a passing test function
   for(var k in this.format_map) {
      var v = this.format_map[k];
      if (this.test_map[v](input, internalErrFunc(k))) {
         formats[formats.length] = k;
      }
   }
   if (errFunc !== null && errs.length > 0)
      errFunc.apply(null, errs);
   return formats.length === 0 ? null : formats;
};