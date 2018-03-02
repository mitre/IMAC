/*

   [[{"id": 0, "a": "a0", "b": "b0", "c": "c0"}, {"id": 1, "a": "a1", "b": "b1", "c": "c1"}], 
    [{"id": 0, "a": "a0", "b": "b0", "c": "c0"}, {"id": 2, "a": "a2", "b": "b2", "c": "c2"}],
    [{"id": 1, "a": "a1", "b": "b1", "c": "c1"}, {"id": 2, "a": "a2", "b": "b2", "c": "c2"}]]

   or (auto-paired)

   [{"id": 0, "a": "a0", "b": "b0", "c": "c0"}, {"id": 1, "a": "a1", "b": "b1", "c": "c1"}, {"id": 2, "a": "a2", "b": "b2", "c": "c2"}]

   or JSON per-line

   {"id": 0, "a": "a0", "b": "b0", "c": "c0"}, {"id": 1, "a": "a1", "b": "b1", "c": "c1"}
   {"id": 0, "a": "a0", "b": "b0", "c": "c0"}{"id": 1, "a": "a1", "b": "b1", "c": "c1"}

   or JSON per-line auto-paired

   {"id": 0, "a": "a0", "b": "b0", "c": "c0"}
   {"id": 1, "a": "a1", "b": "b1", "c": "c1"}

*/

/*
 * common configuration layer
 */
this.init = function(formatHelper) {
   formatHelper.format_map["JSON_OBJECTS"] = 2;
   formatHelper.test_map[2] = this.test;
   formatHelper.conversion_map[2] = {1: this.toIMAC};
};

/*
 * format-specific giblets
 */
this.test = function(input, errFunc = null) {
   var obj = null;
   var isWholeInputJSON = false;
   try {
      obj = JSON.parse(input);
      isWholeInputJSON = true;
   } catch(ex) {
   }

   if (isWholeInputJSON) {

      if (!Array.isArray(obj)) {
         if (errFunc !== null) errFunc("Object is not an array", obj);
         return false;
      }

      if (obj.length == 0) {
         if (errFunc !== null) errFunc("Array is empty", obj);
         return false;
      }

      //test for flat or pre-paired cases
      if (Array.isArray(obj[0])) {
         //make sure that every pair is a pair of objects
         for(var i=0;i<obj.length;i++) {
            if (Array.isArray(obj[i]) && obj[i].length === 2 &&
                  typeof obj[i][0] === "object" && obj[i][0] !== null &&
                  typeof obj[i][1] === "object" && obj[i][1] !== null) {
                continue
            }

            if (errFunc !== null) errFunc(obj[i]+" is not a pair", obj);
            return false;
         }
      } else {
         //make sure that the array is flat, and each item is an object
         for(var i=0;i<obj.length;i++) {
            if (typeof obj[i] === "object" && obj[i] !== null && !Array.isArray(obj[i])) {
                continue
            }

            if (errFunc !== null)
               errFunc(obj[i]+" is not an object", obj);
            return false;
         }
      }
   } else {
      var lines = input.split((/\r?\n/));
      // drop empty ones
      lines = lines.reduce(function(acc, val) { return /\S/.test(val) ? acc.concat(val) : acc; }, []);

      if (lines[0].indexOf('}') < 0)
         return false;

      var closingBracket = lines[0].indexOf('}');
      while(closingBracket > 0) {
         var openingBracket = lines[0].indexOf('{');
         var object = lines[0].slice(openingBracket, closingBracket+1);
         lines[0] = lines[0].slice(closingBracket+1);
         closingBracket = lines[0].indexOf('}');
         try {
            obj = JSON.parse(object);
         } catch (ex) {
            return false;
         }
         console.log(obj);
         if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
            return false;
         }
      }
   }
   return true;
}

function convertOne(keys, obj) {
   //create square-bracket-enclosed |-delimited representation of object, obj
   var values = keys.map(function(key){ return obj[key]; });
   return '['+values.slice(1).reduce(function(acc,val){ return acc+"|"+val; }, values[0])+']';
}

this.toIMAC = function(input, errFunc = null) {
   var obj = null;
   var isWholeInputJSON = false;
   
   try {
      obj = JSON.parse(input);
      isWholeInputJSON = true;
   } catch(ex) {
   }

   var output=null;
   var key_array=[];

   if (isWholeInputJSON) {
      //test for flat or pre-paired cases
      if (Array.isArray(obj[0])) {
         //get the keys from the first object in the first pair
         if (!Array.isArray(obj[0][0])) {
            for (var key in obj[0][0]) {
               output = (output === null ? ("key="+key) : (output + "|"+key));
               key_array[key_array.length] = key;
            }
         } else {
            for (var key in obj[0][0]) {
               key_array[key_array.length] = key;
               key = (key === '0' ? 'id' : ('value' + key));
               output = (output === null ? ("key=" + key) : (output + "|"+key));
            }
         }
         
         //for each pair, output a line containing them together
         for(var i=0;i<obj.length;i++) {
            output += "\n"+convertOne(key_array,obj[i][0])+convertOne(key_array,obj[i][1]);
         }
      } else {
         //get the keys from the first object in the flat array
         if (!Array.isArray(obj[0])) {
            for (var key in obj[0]) {
               output = (output === null ? ("key="+key) : (output + "|"+key));
               key_array[key_array.length] = key;
            }
         } else {
            for (var key in obj[0]) {
               key_array[key_array.length] = key;
               key = (key === '0' ? 'id' : ('value' + key));
               output = (output === null ? ("key=" + key) : (output + "|"+key));
            }
         }

         //for each object in the flat array, add a separate output line
         for(var i=0;i<obj.length;i++) {
            output += "\n"+convertOne(key_array,obj[i]);
         }
      }
   } else {
     var lines = input.split((/\r?\n/));
      // drop empty ones
      lines = lines.reduce(function(acc, val) { return /\S/.test(val) ? acc.concat(val) : acc; }, []);

      for(var i=0;i<lines.length;i++) {
         var closingBracket = lines[i].indexOf('}');
         while(closingBracket > 0) {
            var openingBracket = lines[i].indexOf('{');
            var object = lines[i].slice(openingBracket, closingBracket+1);
            lines[i] = lines[i].slice(closingBracket+1);
            closingBracket = lines[i].indexOf('}');
            try {
               obj = JSON.parse(object);
            } catch (ex) {
               continue;
            }
            if (key_array.length === 0) {
               //get the keys from the first object in the first pair
                if (!Array.isArray(obj)) {
                  for (var key in obj[0]) {
                     output = (output === null ? ("key="+key) : (output + "|"+key));
                     key_array[key_array.length] = key;
                  }
               } else {
                  for (var key in obj[0]) {
                     key_array[key_array.length] = key;
                     key = (key === '0' ? 'id' : ('value' + key));
                     output = (output === null ? ("key=" + key) : (output + "|"+key));
                  }
               }
               output += "\n";
            }
            output += ""+convertOne(key_array, obj);
         }
         if (i < lines.length-1)
            output += "\n";
      }
   }
   console.log("Converted output = ",output);
   return output;
};