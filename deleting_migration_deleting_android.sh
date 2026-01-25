rm public/database.sqlite
clear
echo "file removed"
sleep 2
touch public/database.sqlite
clear
echo "file created"
sleep 2
rm -rf db/migrations
clear
echo "migrations folder removed"
sleep 2
bun db:generate
clear
echo "db generated"
sleep 2
bun db:migrate
clear
echo "db migrated"
sleep 2
rm -rf android
clear
echo "android folder removed"   
bun expo prebuild --platform android
clear
echo "android folder created"
mkdir -p android/app/src/main/assets
cp face_landmarker.task android/app/src/main/assets/
clear
echo "file copied"
bun run android