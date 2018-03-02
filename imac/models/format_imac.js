/*
 * common configuration layer
 */
this.init = function(formatHelper) {
   formatHelper.format_map["IMAC"] = 1;
   formatHelper.test_map[1] = this.test;
   formatHelper.conversion_map[1] = {1: function(input) { return input; }};
};

/*
 * format-specific giblets
 */
this.test = function(input, errFunc = null) {
   var obj = null;
   // separate lines into array
   var lines = input.split((/\r?\n/));
   // drop empty ones
   lines = lines.reduce(function(acc, val) { return /\S/.test(val) ? acc.concat(val) : acc; }, []);

   // are there enough lines to bother?
   if (lines.length == 0) {
      return false;
   }

   var firstDataLine = 1;
   // is the key specified?
   if (lines[0].indexOf("key=") < 0) {
      firstDataLine = 0;
   }

   if (lines[firstDataLine].indexOf("[") < 0 ||
         lines[firstDataLine].indexOf("]") < 0  ||
         lines[firstDataLine].lastIndexOf("]") != lines[firstDataLine].length-1) {
      if (errFunc !== null)
         errFunc("First data line does not start and end with square brackets");
      return false;
   }

   //if whole input is json, then format is not imac
   try {
      obj = JSON.parse(input);
   } catch(ex) {
   }
   if (obj !== null)
      return false;

   //if first data line is json, then format is not imac
   try {
      obj = JSON.parse(lines[firstDataLine]);
   } catch(ex) {
   }
   if (obj !== null)
      return false;

   return true;
};