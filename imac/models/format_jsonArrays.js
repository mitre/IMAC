/*

{"key": ["id", "a", "b", "c"], "data": [[[0,"a0","b0","c0"],[1,"a1","b1","c1"]], [[0,"a0","b0","c0"],[2,"a2","b2","c2"]], [[1,"a1","b1","c1"],[2,"a2","b2","c2"]]]}

or (auto-keyed)

{"data": [[[0,"a0","b0","c0"],[1,"a1","b1","c1"]], [[0,"a0","b0","c0"],[2,"a2","b2","c2"]], [[1,"a1","b1","c1"],[2,"a2","b2","c2"]]]}

or (auto-paired)

{"key": ["id", "a", "b", "c"], "data": [[0,"a0","b0","c0"],[1,"a1","b1","c1"], [2,"a2","b2","c2"]]}

or (auto-keyed and auto-paired)

{"data": [[0,"a0","b0","c0"],[1,"a1","b1","c1"], [2,"a2","b2","c2"]]}

or (per-line arrays)

[0,"a0","b0","c0"], [1,"a1","b1","c1"]
[0,"a0","b0","c0"][1,"a1","b1","c1"]

or (per-line arrays auto-keyed)

[0,"a0","b0","c0"]
[1,"a1","b1","c1"]

[]
*/


/*
 * common configuration layer
 */
this.init = function(formatHelper) {
   formatHelper.format_map["JSON_ARRAYS"] = 4;
   formatHelper.test_map[4] = this.test;
   formatHelper.conversion_map[4] = {1: this.toIMAC};
};

/*
 * format-specific giblets
 */
this.test = function(input, errFunc = null) {
   var obj = null;
   var wholeInputIsJSON = false;
   try {
      obj = JSON.parse(input);
      if (obj !== null)
         wholeInputIsJSON = true;
   } catch(ex) {
   }

   if (wholeInputIsJSON) {

      if (Array.isArray(obj)) {
         return false;
      }

      if (!Array.isArray(obj.data)) {
         return false;
      }
   } else {
      var lines = input.split((/\r?\n/));
      // drop empty ones
      lines = lines.reduce(function(acc, val) { return /\S/.test(val) ? acc.concat(val) : acc; }, []);
      
      if (lines[0].indexOf(']') < 0)
         return false;

      var closingBracket = lines[0].indexOf(']');
      while(closingBracket > 0) {
         var openingBracket = lines[0].indexOf('[');
         var object = lines[0].slice(openingBracket, closingBracket+1);
         lines[0] = lines[0].slice(closingBracket+1);
         closingBracket = lines[0].indexOf(']');
         try {
            obj = JSON.parse(object);
         } catch (ex) {
            return false;
         }
         if (obj === null || !Array.isArray(obj)) {
            return false;
         }
      }
   }

   return true;
}

function convertOne(values) {
   //create square-bracket-enclosed |-delimited representation of array, values
   return '['+values.slice(1).reduce(function(acc,val){ return acc+"|"+val; }, values[0])+']';
}

this.toIMAC = function(input, errFunc = null) {
   var obj = null;
   var wholeInputIsJSON = false;
   try {
      obj = JSON.parse(input);
      wholeInputIsJSON = true;
   } catch(ex) {
   }

   var output=null;
   var key_array=null;
   if (wholeInputIsJSON) {
      console.log("whole input is json!");
      if (typeof(obj.key) !== 'undefined' && Array.isArray(obj.key)) {
         // if key is defined, use it
         key_array = obj.key;
         obj.key.forEach(function(key) {output = (output === null ? ("key="+key) : (output + "|"+key));});
      } else {
         output = "";
      }
      
      //test for flat or pre-paired cases
      if (Array.isArray(obj.data[0])) {
         //for each pair, output a line containing them together
         for(var i=0;i<obj.data.length;i++) {
            output += "\n"+convertOne(obj.data[i][0])+convertOne(obj.data[i][1]);
         }
      } else {
         //for each array in the flat array, add a separate output line
         for(var i=0;i<obj.data.length;i++) {
            output += "\n"+convertOne(obj.data[i]);
         }
      }
   } else {
      output = "";
      var lines = input.split((/\r?\n/));
      // drop empty ones
      lines = lines.reduce(function(acc, val) { return /\S/.test(val) ? acc.concat(val) : acc; }, []);

      for(var i=0;i<lines.length;i++) {
         var closingBracket = lines[i].indexOf(']');
         if (closingBracket )
         while(closingBracket > 0) {
            var openingBracket = lines[i].indexOf('[');
            var object = lines[i].slice(openingBracket, closingBracket+1);
            lines[i] = lines[i].slice(closingBracket+1);
            closingBracket = lines[i].indexOf(']');
            try {
               obj = JSON.parse(object);
            } catch (ex) {
               continue;
            }
            output += ""+convertOne(obj);
         }
         if (i < lines.length-1)
            output += "\n";
      }
   }
   output = output.replace(/^\n+/,"");
   console.log("Converted output = ",output);
   return output;
};