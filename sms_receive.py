#!/usr/bin/python
import sys
import urllib2
import json

def callQuickCountServer(sms_info):
  http_handler = urllib2.HTTPHandler()
  opener = urllib2.build_opener(http_handler)

  url = "http://votefast.insite.co.id/insite/inbound-sms"
  data = {
    "msisdn": sms_info["sender"],
    "text": " ".join(sms_info["message"])
  }

  request = urllib2.Request(url, headers = { "Content-Type": "application/json" }, data = json.dumps(data))
  request.get_method = lambda: "POST"

  try:
    conn = opener.open(request)
  except urllib2.HTTPError as e:
    conn = e

  if conn.code == 200:
    data = conn.read()
  else:
    print "Error"

with open(sys.argv[2], "r") as sms_fp:
  sms_info_dict = { "message": [] }
  for x, line in enumerate(sms_fp):
    if x == 0:
      sender = line[6:]
      sender = sender.strip()
      sms_info_dict["sender"] = sender
    elif x == 3:
      sms_info_dict["sent"] = line
    elif x == 4:
      sms_info_dict["received"] = line
    elif x > 12:
      sms_info_dict["message"].append(line)

  callQuickCountServer(sms_info_dict)
