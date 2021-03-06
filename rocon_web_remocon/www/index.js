/**
  * @fileOverview Web version of rocon remocon
  * @author Janghee Cho [roycho111@naver.com]
  * @copyright Yujin Robot 2014.
*/

var ros = new ROSLIB.Ros();
var gListRoles = [];
var gListInteractions = [];
var gFinalUrl;

var gUrl;
var gCookieCount;

var defaultUrl;

// Starts here
$(document).ready(function () {
  init();
  connect();
  disconnect();
  addUrl();
  deleteUrl();
  listItemSelect();
  startApp();
  getBrowser();

  if(defaultUrl != undefined) {
    gUrl = defaultUrl;
    ros.connect(defaultUrl);
  }
});


/**
  * Initialize lists, set ROS callbacks, read cookies.
  *
  * @function init
*/
function init() {
  setROSCallbacks();
  readCookies();
  initList();
}

/**
  * Receive and set ROS callbacks
  *
  * @function setROSCallbacks
*/
function setROSCallbacks() {
  ros.on('error', function(error) {
    // throw exception for error
    console.log('Connection refused. Is the master running?');
    alert('Connection refused. Is the master running?');

    $("#connectBtn").show();
    $("#disconnectBtn").hide();
        
    initList();
  });

  ros.on('connection', function() {
    console.log('Connection made!');

    $("#connectBtn").hide();
    $("#disconnectBtn").show();
        
    initList();
    displayMasterInfo();
    getRoles();
    masterInfoMode();
  });

  ros.on('close', function() {
    console.log('Connection closed.');

    $("#connectBtn").show();
    $("#disconnectBtn").hide();
        
    initList();
  });
}

/**
  * Read cookies and add to url list
  *
  * @function readCookies
*/
function readCookies() {
  $.cookie.defaults = { path: '/', expires: 365 };

  gCookieCount = $.cookie("cookieCount");

  // init cookie count
  if (gCookieCount == null || gCookieCount < 0) {
    $.cookie("cookieCount", 0);
    gCookieCount = 0;
  }

  // read cookie and add to url list
  for (var i = 0; i < gCookieCount; i++) {
    $("#urlList").append(new Option($.cookie("cookie_url" + i)));
    $("#urlList option:last").attr("cookieNum", i);
  }
}

/**
  * Event function when 'Connect' button clicked
  *
  * @function connect
*/
function connect() {
  $("#connectBtn").click(function () {
    var url = $("#urlList option:selected").val();
    
    if (url == "(Please add URL)") {
      return;
    }

    gUrl = url;

    // extract the exact url
    var newUrl;
    newUrl = url.replace("ws://", "");

    for (var i = 0; i < newUrl.length; i++) {
      newUrl = newUrl.replace("/", "");
      newUrl = newUrl.replace(" ", "");
    }
        
    // set default port
    if (newUrl.search(":") < 0) {
      newUrl += ":9090";
    }

    ros.connect('ws://' + newUrl);
  });
}

/**
  * Event function when 'Disconnect' button clicked
  *
  * @function disconnect
*/
function disconnect() {
  $("#disconnectBtn").hide();
  $("#disconnectBtn").click(function () {
    ros.close();
    addUrlMode();
  });
}

/**
  * Event function when 'Add Url' button clicked
  *
  * @function addUrl
*/
function addUrl() {
  $("#addurl_addBtn").click(function () {
    var url = $("#typeURL").val();

    // set default string
    if (url == "" || url == "ws://") {
      url = "ws://localhost:9090";
    }

    // add url
    $("#urlList").append(new Option(url));
    $("#urlList option:last").attr("selected", "selected");
    $("#urlList option:last").attr("cookieNum", gCookieCount);

    // add cookie
    $.cookie("cookie_url" + gCookieCount, url);
    $.cookie("cookieCount", ++gCookieCount);
  });
}

/**
  * Event function when 'Minus' button clicked
  *
  * @function deleteUrl
*/
function deleteUrl() {
  $("#urldeleteBtn").click(function () {
    if ($("#urlList option:selected").val() != "(Please add URL)") {
      // delete cookie
      var cookieNum = $("#urlList option:selected").attr("cookieNum");
      $.cookie("cookie_url" + cookieNum, null);
            
      if (gCookieCount > 0) {
        $.cookie("cookieCount", --gCookieCount);
      }
            
      $("#urlList option:selected").remove();

      var listCount = $("#urlList option").length;
      var tempCount = 0;

      // rearrange cookies
      // not including the first disabled option
      for (var i = 1; i < listCount; i++) {
        var url = $("#urlList option:eq(" + i + ")").val();

        $("#urlList option:eq(" + i + ")").attr("cookieNum", tempCount);
        $.cookie("cookie_url" + tempCount, url);
        tempCount++;
      }
    }
  });
}

/**
  * Display master's info to the screen
  *
  * @function displayMasterInfo
*/
function displayMasterInfo() {
  $("#selecturl").hide();
  $("#masterinfo").show();

  subscribeTopic(ros, "/concert/info", "rocon_std_msgs/MasterInfo", function(message) {
    $("#masterinfopanel").append('<p style="float: left"><img src="data:' + message["icon"]["resource_name"] + ';base64,' + message["icon"]["data"] + '" alt="Red dot" style="height:75px; width:75px;"></p>');
    $("#masterinfopanel").append('<p><strong>&nbsp;&nbsp;&nbsp;name</strong> : ' + message["name"] +'</p>');
    $("#masterinfopanel").append('<p><strong>&nbsp;&nbsp;&nbsp;master_url</strong> : ' + gUrl +'</p>');
    $("#masterinfopanel").append('<p><strong>&nbsp;&nbsp;&nbsp;description</strong> : ' + message["description"] +'</p>');
  });
}

/**
  * Call service for roles and add to role list
  *
  * @function getRoles
*/
function getRoles() {
  var browser = getBrowser();
  var request = new ROSLIB.ServiceRequest({
    uri : 'rocon:/*/*/*/' + browser
  });

  callService(ros, '/concert/interactions/get_roles', 'rocon_interaction_msgs/GetRoles', request, function(result) {
    for (var i = 0; i < result.roles.length; i++) {
      gListRoles.push(result.roles[i]);
    }
        
    displayRoles();
  });
}

/**
  * Display the roles list to the screen
  *
  * @function displayRoles
*/
function displayRoles() {
  for (var i = 0; i < gListRoles.length; i++) {
    $("#roles_listgroup").append('<a href="#" id="rolelist_' + i + '" class="list-group-item"><strong>' + gListRoles[i] + '</strong></a>');
  }
}

/**
  * Call service for interactions and add to interaction list
  *
  * @function getInteractions
  *
  * @param {string} selectedRole
*/
function getInteractions(selectedRole) {
  var browser = getBrowser();
  var request = new ROSLIB.ServiceRequest({
    roles : [selectedRole],
    uri : 'rocon:/*/*/*/' + browser
  });

  callService(ros, '/concert/interactions/get_interactions', 'rocon_interaction_msgs/GetInteractions', request, function(result) {
    for (var i = 0; i < result.interactions.length; i++) {
      gListInteractions.push(result.interactions[i]);
    }
        
    displayInteractions();
  });
}

/**
  * Display the interaction list to the screen
  *
  * @function displayInteractions
*/
function displayInteractions() {
  for (var i = 0; i < gListInteractions.length; i++) {
    $("#interactions_listgroup").append('<a href="#" id="interactionlist_' + i + '" class="list-group-item"><img src="data:' + gListInteractions[i].icon.resource_name + ';base64,' + gListInteractions[i].icon.data + '" alt="Red dot" style="height:50px; width:50px;"></img>&nbsp;&nbsp;&nbsp;<strong>' + gListInteractions[i].display_name + '</strong></a>');
  }
}

/**
  * Classify the interaction whether it's (web_url) or (web_app)
  *
  * @function classifyInteraction
  *
  * @param {interaction} interaction
  * @returns {string} extracted url
*/
function classifyInteraction(interaction) {
  var newUrl;
  var url = interaction.name;

  if (url.search("web_url") >= 0) {
    newUrl = url.substring(8, url.length - 1);
  }
  else if (url.search("web_app") >= 0) {
    var tempUrl = url.substring(8, url.length - 1);
    newUrl = prepareWebappUrl(interaction, tempUrl);
  }
  else {
    newUrl = null;
  }

  return newUrl;
}

/**
  * Url synthesiser for sending remappings and parameters information
  *
  * @function prepareWebappUrl
  * 
  * @param {interaction} interaction
  * @param {string} baseUrl - url before edited
  * @returns {string} the final remapped url
*/
function prepareWebappUrl(interaction, baseUrl) {
  // convert and set the informations
  var interactionData = {};
  interactionData['display_name'] = interaction.display_name;
  interactionData['parameters'] = jsyaml.load(interaction.parameters);
  interactionData['remappings'] = {};

  $.each(interaction.remappings, function(key, value) {
    interactionData['remappings'][value.remap_from] = value.remap_to;
  });
    
  // Package all the data in json format and dump it to one query string variable
  queryStringMappings = {};
  queryStringMappings['interaction_data'] = JSON.stringify(interactionData);
    
  // Encode the url and finish constructing
  var url = baseUrl + "?interaction_data=" + encodeURIComponent(queryStringMappings['interaction_data']);

  return url;
}

/**
  * Display the description list to the screen
  *
  * @function displayDescription
  *
  * @param {interaction} interaction
*/
function displayDescription(interaction) {
  $("#startappBtn").show();
    
  $("#descriptionpanel").append('<p><strong>name</strong> : ' + interaction["name"] + '</p><hr>');
    
  $("#descriptionpanel").append('<p><strong>display_name</strong> : ' + interaction["display_name"] + '</p>');
  $("#descriptionpanel").append('<p><strong>description</strong> : ' + interaction["description"] + '</p>');
  $("#descriptionpanel").append('<p><strong>compatibility</strong> : ' + interaction["compatibility"] + '</p>');
  $("#descriptionpanel").append('<p><strong>namespace</strong> : ' + interaction["namespace"] + '</p><hr>');
    
  var remapFrom;
  var remapTo;
  $.each(interaction["remappings"], function(key, value) {
    remapFrom = value.remap_from;
    remapTo = value.remap_to;
  });
    
  $("#descriptionpanel").append('<p><strong>remappings</strong> : [remap_from:' + remapFrom + '] [remap_to:' + remapTo +']</p>');
  $("#descriptionpanel").append('<p><strong>parameters</strong> : ' + interaction["parameters"] + '</p>');
}

/**
  * Event function when item in role list and interaction list is clicked
  *
  * @function listItemSelect
*/
function listItemSelect() {
  // role list
  $("#roles_listgroup").on("click", "a", function (e) {
    e.preventDefault();

    initInteractionList();
    initDescriptionList();

    var listCount = $("#roles_listgroup").children().length;
    for (var i = 0; i < listCount; i++) {
      $("#roles_listgroup").children(i).attr('class', 'list-group-item');
    }
    $(this).toggleClass('list-group-item list-group-item active');

    var index = $(this).attr('id').charAt($(this).attr('id').length - 1);
    getInteractions(gListRoles[index]);
  });

  // interaction list
  $("#interactions_listgroup").on("click", "a", function (e) {
    e.preventDefault();
        
    initDescriptionList();

    var listCount = $("#interactions_listgroup").children().length;
    for (var i = 0; i < listCount; i++) {
      $("#interactions_listgroup").children(i).attr('class', 'list-group-item');
    }
    $(this).toggleClass('list-group-item list-group-item active');

    var index = $(this).attr('id').charAt($(this).attr('id').length - 1);
    gFinalUrl = classifyInteraction(gListInteractions[index]);
    displayDescription(gListInteractions[index]);
  });
}

/**
  * Event function when 'Start App' button is clicked
  *
  * @function startApp
*/
function startApp() {
  $("#startappBtn").hide();
  $("#startappBtn").click(function () {
    if (gFinalUrl == null) {
      alert("not available on this platform");
      return;
    }
    window.open(gFinalUrl);
  });
}

/**
  * Initialize all lists
  *
  * @function initList
*/
function initList() {
    initMasterInfo();
    initRoleList();
    initInteractionList();
    initDescriptionList();
    addUrlMode();
}

/**
  * Initialize master's info panel
  *
  * @function initMasterInfo
*/
function initMasterInfo() {
    $("#masterinfopanel").children().remove();
}

/**
  * Initialize role list
  *
  * @function initRoleList
*/
function initRoleList() {
    gListRoles = [];
    $("#roles_listgroup").children().remove();
}

/**
  * Initialize interaction list
  *
  * @function initInteractionList
*/
function initInteractionList() {
    gListInteractions = [];
    $("#interactions_listgroup").children().remove();
    $("#startappBtn").hide();
}

/**
  * Initialize description list
  *
  * @function initDescriptionList
*/
function initDescriptionList() {
    $("#descriptionpanel").children().remove();
    $("#startappBtn").hide();
}

/**
  * Switch to masterinfo mode
  *
  * @function masterInfoMode
*/
function masterInfoMode() {
    $("#selecturl").hide();
    $("#masterinfo").show();
    $("#urladdBtn").hide();
    $("#urldeleteBtn").hide();
}

/**
  * Switch to addurl mode
  *
  * @function addUrlMode
*/
function addUrlMode() {
    $("#selecturl").show();
    $("#masterinfo").hide();
    $("#urladdBtn").show();
    $("#urldeleteBtn").show();
}

/**
  * Wrapper function for Service.callService
  *
  * @function callService
  *
  * @param {ROSLIB.Ros} ros - handled ros
  * @param {string} serviceName - service's name
  * @param {string} serviceType - service's type
  * @param {ROSLIB.ServiceRequest} request - request
  * @param {callBack} callback for request response
*/
function callService(ros, serviceName, serviceType, request, callBack) {
  var service = new ROSLIB.Service({
    ros : ros,
    name : serviceName,
    serviceType : serviceType
  });

  // get response
  try {
    service.callService(request, function(result){
    callBack(result);
    }, 
    function(error) {
      alert(error);
      console.log(error);
    });
  } catch (e) {
      console.log(message);
      alert(e.message);
  } 
}

/**
  * Wrapper function for Topic.subscribe
  *
  * @function subscribeTopic
  *
  * @param {ROSLIB.Ros} ros - handled ros
  * @param {string} topicName - topic's name
  * @param {string} msgType - message type
  * @param {callBack} callback for returned message
*/
function subscribeTopic(ros, topicName, msgType, callBack) {
  var listener = new ROSLIB.Topic({
    ros : ros,
    name : topicName,
    messageType : msgType
  });
    
  // get returned message
  listener.subscribe(function(message) {
    callBack(message);
    listener.unsubscribe();
  });
}

/**
  * Get browser name
  *
  * @function getBrowser
  *
  * @returns {string} current browser's name
*/
function getBrowser() {
  var agt = navigator.userAgent.toLowerCase();
  if (agt.indexOf("chrome") != -1) return 'chrome';
  if (agt.indexOf("crios") != -1) return 'chrome'; // for ios
  if (agt.indexOf("opera") != -1) return 'opera';
  if (agt.indexOf("firefox") != -1) return 'firefox';
  if (agt.indexOf("safari") != -1) return 'safari';
  if (agt.indexOf("msie") != -1) return 'internet_explorer';
  
}

