define(function() {
	var helper = {
		removeByValue: function(arr, val) {
			for(let k in arr){
				if(arr[k] == val) {
					arr.splice(k,1);
					return true;
				}
			}
			return false;
		},
		hasValue: function(arr, val) {
			arr.indexOf(val) != -1;
		},
		clone: function(obj) {
		    if (null == obj || "object" != typeof obj) return obj;
		    var copy = obj.constructor();
		    for (var attr in obj) {
		        if (obj.hasOwnProperty(attr)) copy[attr] = helper.clone(obj[attr]);
		    }
		    return copy;
		}
	}

	return helper;
})