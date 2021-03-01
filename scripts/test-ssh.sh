#!/bin/bash

echo "Archieving API"

git archive --output=./test.tar --format=tar HEAD

# Add AWS key
ssh-add - <<< "$AWS_SECRET_KEY"

scp -o "StrictHostKeyChecking no" \
    -o "UserKnownHostsFile /dev/null" \
    test.tar \
    ec2-user@18.188.93.59:~/deploy/uploads/

